const fetch = require('node-fetch');

class EmailService {
  async sendOTPEmail(email, otp) {
    try {
      const response = await fetch('https://api.zeptomail.com/v1.1/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Zoho-enczapikey ${process.env.ZEPTOMAIL_API_KEY}`
        },
        body: JSON.stringify({
          from: {
            address: process.env.ZEPTOMAIL_FROM_EMAIL,
            name: process.env.ZEPTOMAIL_FROM_NAME
          },
          to: [
            {
              email_address: {
                address: email,
                name: email.split('@')[0]
              }
            }
          ],
          subject: 'Finzip Login OTP',
          htmlbody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Finzip Login Verification</h2>
              <p>Your OTP for login verification is:</p>
              <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px; margin: 20px 0;">${otp}</h1>
              <p>This OTP is valid for 1 minutes.</p>
              <p style="color: #666; font-size: 14px;">For security reasons, please do not share this OTP with anyone.</p>
              <hr style="border: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
            </div>
          `
        })
      });

      const data = await response.json();
      console.log('Zeptomail API response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send email');
      }

      return { success: true };
    } catch (error) {
      console.error('Email sending error:', error);
      return { error: 'Failed to send email' };
    }
  }
}

module.exports = new EmailService(); 