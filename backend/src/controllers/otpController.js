const otpService = require('../services/otpService');
const supabase = require('../config/supabase');

class OTPController {
  async generateAndSendOTP(req, res) {
    try {
      const { userId, identifier } = req.body;
      const email = userId; // Using userId as email

      if (!email || !identifier) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Generate and store OTP, and send via both SMS and email
      const { otp, error: otpError } = await otpService.createOTP(email, identifier);
      
      if (otpError) {
        console.error('OTP generation error:', otpError);
        return res.status(400).json({ error: otpError });
      }

      res.json({ success: true, message: 'OTP sent successfully via SMS and email' });
    } catch (error) {
      console.error('Generate OTP error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async verifyOTP(req, res) {
    try {
      const { userId, otp } = req.body;
      const email = userId; // Using userId as email

      if (!email || !otp) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { verified, error } = await otpService.verifyOTP(email, otp);
      
      if (error) {
        console.error('OTP verification error:', error);
        return res.status(400).json({ error });
      }

      res.json({ verified });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async resendOTP(req, res) {
    try {
      const { userId, identifier } = req.body;
      const email = userId; // Using userId as email

      if (!email || !identifier) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Generate and store new OTP, and send via both SMS and email
      const { otp, error: otpError } = await otpService.createOTP(email, identifier);
      
      if (otpError) {
        console.error('OTP resend error:', otpError);
        return res.status(400).json({ error: otpError });
      }

      res.json({ success: true, message: 'New OTP sent successfully via SMS and email' });
    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new OTPController(); 