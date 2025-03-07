const supabase = require('../config/supabase');
const fetch = require('node-fetch');
const emailService = require('./emailService');

class OTPService {
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createOTP(email, identifier) {
    try {
      // Check rate limiting
      const canRequest = await this.canRequestNewOTP(email);
      if (!canRequest.allowed) {
        return { error: canRequest.message };
      }

      const otp = this.generateOTP();
      const expiryTime = new Date(Date.now() + process.env.OTP_EXPIRY_SECONDS * 1000);

      // Get user data - email is the email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email, phone')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        return { error: 'User not found' };
      }

      // Store OTP
      const { error } = await supabase
        .from('otp_codes')
        .insert([{
          email: email,
          otp_code: otp,
          expires_at: expiryTime.toISOString(),
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error creating OTP:', error);
        return { error: 'Failed to create OTP' };
      }

      // Send OTP via both SMS and email
      const smsPromise = this.sendSMS(userData.phone, otp);
      const emailPromise = emailService.sendOTPEmail(userData.email, otp);

      const [smsResult, emailResult] = await Promise.all([smsPromise, emailPromise]);

      if (smsResult.error && emailResult.error) {
        return { error: 'Failed to send OTP via both SMS and email' };
      }

      return { otp };
    } catch (error) {
      console.error('OTP creation error:', error);
      return { error: 'Internal server error' };
    }
  }

  async verifyOTP(email, otp) {
    try {
      // Find the most recent non-expired, non-used OTP for this user
      const { data, error } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('email', email)
        .eq('otp_code', otp)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching OTP:', error);
        return { verified: false, error: 'Failed to verify OTP' };
      }

      if (!data || data.length === 0) {
        return { verified: false, error: 'No valid OTP found or OTP expired' };
      }

      // Delete the used OTP
      const { error: deleteError } = await supabase
        .from('otp_codes')
        .delete()
        .eq('id', data[0].id);

      if (deleteError) {
        console.error('Error deleting used OTP:', deleteError);
        // Continue anyway, not critical
      }

      return { verified: true };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { verified: false, error: 'Internal server error' };
    }
  }

  async canRequestNewOTP(email) {
    try {
      // 30 seconds rate limit
      const rateLimitWindow = 30000; // 30 seconds
      
      // If email is not provided, allow the request
      if (!email) {
        return { allowed: true };
      }
      
      const windowStart = new Date(Date.now() - rateLimitWindow).toISOString();
      
      // Count recent OTP requests
      const { data, error } = await supabase
        .from('otp_codes')
        .select('created_at')
        .eq('email', email)
        .gt('created_at', windowStart);
      
      if (error) {
        console.error('Error checking rate limit:', error);
        // Allow the request if we can't check the rate limit
        return { allowed: true };
      }
      
      if (data && data.length > 0) {
        return { 
          allowed: false, 
          message: `Too many OTP requests. Please try again after 30 seconds.` 
        };
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Allow the request if we can't check the rate limit
      return { allowed: true };
    }
  }

  async sendSMS(phone, otp) {
    try {
      // Format phone number: Add 91 prefix if not present and remove any '+' symbol
      let formattedPhone = phone.replace(/\+/g, '');
      if (!formattedPhone.startsWith('91')) {
        formattedPhone = '91' + formattedPhone;
      }

      const message = `Welcome to Finzip!
OTP for Login Transaction is ${otp} and valid for 1 minutes. Do not share this OTP to anyone for security reasons. -Finzip`;

      const response = await fetch('https://api.textlocal.in/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          apikey: process.env.TEXTLOCAL_API_KEY,
          numbers: formattedPhone,
          message: message,
          sender: 'FINZIP',
          test: false
        })
      });

      const data = await response.json();

      if (data.status !== 'success') {
        console.error('TextLocal API error:', data);
        throw new Error(data.errors?.[0]?.message || 'Failed to send SMS');
      }

      return { success: true };
    } catch (error) {
      console.error('SMS sending error:', error);
      return { error: 'Failed to send SMS' };
    }
  }

  async cleanupExpiredOTPs() {
    try {
      const { error } = await supabase
        .from('otp_codes')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('OTP cleanup error:', error);
      }
    } catch (error) {
      console.error('OTP cleanup error:', error);
    }
  }
}

module.exports = new OTPService(); 