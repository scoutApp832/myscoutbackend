// Load environment variables FIRST
require('dotenv').config();

// Verify they're loaded
console.log('📧 Email Configuration Check:');
console.log(`  SMTP_USER: ${process.env.SMTP_USER ? '✅' : '❌'}`);
console.log(`  SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? '✅ (length: ' + process.env.SMTP_PASSWORD.length + ')' : '❌'}`);
console.log(`  SMTP_HOST: ${process.env.SMTP_HOST || '❌'}`);
console.log(`  SMTP_PORT: ${process.env.SMTP_PORT || '❌'}`);

// If password is missing, exit
if (!process.env.SMTP_PASSWORD) {
  console.error('\n❌ SMTP_PASSWORD is not set in .env file!');
  console.log('Please add this line to your .env file:');
  console.log('SMTP_PASSWORD=yjibyrklbtowmdre');
  process.exit(1);
}

const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('\n🔌 Connecting to SMTP server...');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    // Send test email
    console.log('\n📧 Sending test email...');
    const info = await transporter.sendMail({
      from: `"Scout System Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: '✅ Test Email - Scout Management System',
      text: 'This is a test email from your Scout Management System.',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #2c3e50;">✅ Email Configuration Test</h2>
          <p>Your email configuration is working correctly!</p>
          <div style="background: #d4edda; padding: 15px; border-radius: 5px; color: #155724;">
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Time: ${new Date().toLocaleString()}</li>
              <li>Email Server: ${process.env.SMTP_HOST}</li>
              <li>From: ${process.env.SMTP_USER}</li>
            </ul>
          </div>
          <p style="color: #666; font-size: 12px;">This is an automated test email.</p>
        </div>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📧 Sent to: ${process.env.SMTP_USER}`);
    console.log('\n💡 Check your inbox!');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('Error details:', error);
  }
}

testEmail();