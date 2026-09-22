// backend/src/services/emailService.js

const path = require('path');
const fs = require('fs');

// ============================================
// BREVO EMAIL CONFIGURATION
// ============================================

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const getBrevoApiKey = () => {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error(
      'BREVO_API_KEY is not configured. Add BREVO_API_KEY to the environment variables.'
    );
  }

  return apiKey;
};

// ============================================
// EMAIL SENDER CONFIGURATION
// ============================================

const getEmailSender = () => {
  /*
   * Preferred:
   *
   * EMAIL_FROM=MSR Rwanda <your-verified-email@example.com>
   *
   * Or:
   *
   * BREVO_FROM_EMAIL=your-verified-email@example.com
   * BREVO_FROM_NAME=MSR Rwanda
   */

  const configuredFrom =
    process.env.EMAIL_FROM ||
    process.env.BREVO_FROM_EMAIL ||
    '';

  const configuredName =
    process.env.BREVO_FROM_NAME ||
    'MSR Rwanda';

  // Support:
  // "MSR Rwanda" <email@example.com>
  const match = configuredFrom.match(
    /^\s*(?:"?([^"]+)"?)?\s*<([^>]+)>\s*$/
  );

  if (match) {
    return {
      email: match[2].trim(),
      name: (match[1] || configuredName).trim()
    };
  }

  // Support plain email:
  // email@example.com
  if (
    configuredFrom &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredFrom.trim())
  ) {
    return {
      email: configuredFrom.trim(),
      name: configuredName
    };
  }

  /*
   * Fallback to the old SMTP_USER variable if it still exists.
   * This allows the application to keep working while the
   * environment variables are being migrated.
   */
  if (
    process.env.SMTP_USER &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.SMTP_USER.trim())
  ) {
    return {
      email: process.env.SMTP_USER.trim(),
      name: configuredName
    };
  }

  throw new Error(
    'Email sender is not configured. Set EMAIL_FROM to a verified Brevo sender.'
  );
};

// ============================================
// SEND EMAIL THROUGH BREVO
// ============================================

const sendBrevoEmail = async ({
  to,
  subject,
  html,
  text,
  attachments = []
}) => {
  if (!to) {
    throw new Error('Recipient email address is required');
  }

  const apiKey = getBrevoApiKey();
  const sender = getEmailSender();

  const payload = {
    sender: {
      name: sender.name,
      email: sender.email
    },
    to: [
      {
        email: to
      }
    ],
    subject,
    htmlContent: html
  };

  // Keep plain-text email content when supplied.
  if (text) {
    payload.textContent = text;
  }

  // Brevo expects attachment content as base64.
  if (attachments.length > 0) {
    payload.attachment = attachments.map((attachment) => ({
      name: attachment.filename,
      content:
        Buffer.isBuffer(attachment.content)
          ? attachment.content.toString('base64')
          : attachment.content
    }));
  }
console.log('📧 Connecting to Brevo API...');
console.log(`📧 Recipient: ${to}`);
console.log(`📧 Attachment count: ${attachments.length}`);

const controller = new AbortController();

const timeout = setTimeout(() => {
  console.error('❌ Brevo API request timed out after 30 seconds');
  controller.abort();
}, 30000);

let response;

try {
  response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });

  console.log(`📧 Brevo API responded with status: ${response.status}`);
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error(
      'Brevo API request timed out after 30 seconds. Check internet connection or Brevo API availability.'
    );
  }

  throw error;
} finally {
  clearTimeout(timeout);
}
 
  const responseText = await response.text();

  let responseData = {};

  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch (parseError) {
    responseData = {
      raw: responseText
    };
  }

  if (!response.ok) {
    const errorMessage =
      responseData?.message ||
      responseData?.code ||
      responseData?.error ||
      responseText ||
      `Brevo API request failed with status ${response.status}`;

    const error = new Error(
      `Brevo email error (${response.status}): ${errorMessage}`
    );

    error.status = response.status;
    error.response = responseData;

    throw error;
  }

  return {
    messageId:
      responseData?.messageId ||
      responseData?.messageID ||
      responseData?.id ||
      null,
    response: responseData
  };
};

// ============================================
// VERIFY BREVO EMAIL CONFIGURATION
// ============================================

async function verifyEmailConnection() {
  try {
    getBrevoApiKey();
    getEmailSender();

    console.log('✅ Brevo email configuration detected');
    return {
      success: true,
      message: 'Brevo email configuration is ready'
    };
  } catch (error) {
    console.error('❌ Brevo email configuration error:', error.message);
    throw error;
  }
}

// ============================================
// ✅ SEND WELCOME EMAIL
// ============================================

async function sendWelcomeEmail(user, member, role) {
  try {
    const appUrl =
      process.env.FRONTEND_URL || 'http://localhost:3000';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to MSR Rwanda</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { text-align: center; padding-bottom: 20px; border-bottom: 4px solid #FFD100; }
          .header h1 { color: #006B3F; margin: 0; font-size: 28px; }
          .header .subtitle { color: #6B7280; font-size: 14px; margin-top: 4px; }
          .badge { display: inline-block; background: #FFD100; color: #006B3F; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 8px; }
          .content { padding: 30px 0; }
          .content h2 { color: #006B3F; font-size: 22px; margin-top: 0; }
          .content p { color: #374151; line-height: 1.6; font-size: 15px; }
          .info-box { background: #F9FAFB; border-left: 4px solid #FFD100; padding: 16px 20px; margin: 20px 0; border-radius: 4px; }
          .info-box strong { color: #006B3F; }
          .btn { display: inline-block; background: #FFD100; color: #006B3F; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .btn:hover { background: #f5c800; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
          .sin-number { font-size: 20px; font-weight: bold; color: #006B3F; font-family: 'Courier New', monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏕️ MSR Rwanda</h1>
            <p class="subtitle">MyScout Rwanda - Welcome</p>
            <span class="badge">✅ WELCOME</span>
          </div>
          <div class="content">
            <h2>🎉 Welcome to MyScout Rwanda, ${user?.full_name || member?.first_name || 'Scout'}!</h2>
            
            <p>Thank you for joining the <strong>MyScout Rwanda (MSR)</strong> platform. Your account has been successfully created.</p>
            
            <div class="info-box">
              <strong>📋 Your Account Details:</strong><br>
              <strong>Name:</strong> ${user?.full_name || 'N/A'}<br>
              <strong>Email:</strong> ${user?.email || 'N/A'}<br>
              <strong>Role:</strong> ${role || 'Scout'}<br>
              <strong>SIN (Scout Identification Number):</strong> <span class="sin-number">${member?.sin || 'N/A'}</span>
            </div>

            <p><strong>What you can do next:</strong></p>
            <ul style="color: #374151; line-height: 1.8;">
              <li>🔑 <strong>Log in</strong> to your account using your email and password</li>
              <li>📅 <strong>Register</strong> for upcoming events and activities</li>
              <li>📚 <strong>Enroll</strong> in training courses and workshops</li>
              <li>🏆 <strong>Track</strong> your progress and earn badges</li>
              <li>💡 <strong>Submit</strong> your ideas and projects</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/login" class="btn">🔑 Go to Login</a>
            </div>

            <p style="font-size: 13px; color: #6B7280; text-align: center;">
              <strong>💡 Keep your SIN safe:</strong> ${member?.sin || 'N/A'}<br>
              You'll need it for event registration and verification.
            </p>
          </div>
          <div class="footer">
            <p><strong>MSR Rwanda - MyScout Rwanda</strong><br>Building better citizens through scouting</p>
            <p>© ${new Date().getFullYear()} MSR Rwanda. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await sendBrevoEmail({
      to: user?.email,
      subject: `🎉 Welcome to MyScout Rwanda, ${user?.full_name || 'Scout'}!`,
      html: htmlContent
    });

    console.log(`✅ Welcome email sent to ${user?.email}`);

    return {
      success: true,
      messageId: info.messageId,
      to: user?.email
    };
  } catch (error) {
    console.error('❌ Welcome email error:', error);
    throw error;
  }
}

// ============================================
// ✅ SEND PASSWORD RESET EMAIL
// ============================================

async function sendPasswordResetEmail({
  email,
  name,
  resetUrl
}) {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - MSR Rwanda</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { text-align: center; padding-bottom: 20px; border-bottom: 4px solid #FFD100; }
          .header h1 { color: #006B3F; margin: 0; font-size: 28px; }
          .header .subtitle { color: #6B7280; font-size: 14px; margin-top: 4px; }
          .badge { display: inline-block; background: #FFD100; color: #006B3F; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 8px; }
          .content { padding: 30px 0; }
          .content h2 { color: #006B3F; font-size: 22px; margin-top: 0; }
          .content p { color: #374151; line-height: 1.6; font-size: 15px; }
          .info-box { background: #F9FAFB; border-left: 4px solid #FFD100; padding: 16px 20px; margin: 20px 0; border-radius: 4px; }
          .btn { display: inline-block; background: #FFD100; color: #006B3F; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .btn:hover { background: #f5c800; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 MSR Rwanda</h1>
            <p class="subtitle">Password Reset Request</p>
            <span class="badge">🔑 RESET</span>
          </div>
          <div class="content">
            <h2>Hello ${name || 'Scout'}!</h2>
            
            <p>We received a request to reset your password for your <strong>MyScout Rwanda</strong> account.</p>
            
            <div class="info-box">
              <strong>📋 Click the button below to reset your password:</strong>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="btn">🔑 Reset Password</a>
            </div>

            <p style="font-size: 14px; color: #6B7280;">
              This link will expire in <strong>30 minutes</strong>.
            </p>

            <p style="font-size: 13px; color: #6B7280;">
              If you didn't request this, please ignore this email or contact support.
            </p>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
            
            <p style="font-size: 12px; color: #6B7280;">
              <strong>Having trouble?</strong> Copy and paste this URL into your browser:<br>
              <span style="word-break: break-all; color: #006B3F;">${resetUrl}</span>
            </p>
          </div>
          <div class="footer">
            <p><strong>MSR Rwanda - MyScout Rwanda</strong><br>Building better citizens through scouting</p>
            <p>© ${new Date().getFullYear()} MSR Rwanda. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await sendBrevoEmail({
      to: email,
      subject: '🔐 Reset Your MyScout Rwanda Password',
      html: htmlContent
    });

    console.log(`✅ Password reset email sent to ${email}`);

    return {
      success: true,
      messageId: info.messageId,
      to: email
    };
  } catch (error) {
    console.error('❌ Password reset email error:', error);
    throw error;
  }
}

// ============================================
// SEND SCOUT ID CARD WITH PDF ATTACHMENT
// ============================================

async function sendScoutIDCardPDF(member, pdfBase64) {
  try {
    const user = member.user;

    if (!user || !user.email) {
      throw new Error(
        'No email address found for this member'
      );
    }

    const appUrl =
      process.env.FRONTEND_URL || 'http://localhost:3000';

    // Handle both data:...;base64,... and raw base64
    let base64Data = pdfBase64;

    if (pdfBase64 && pdfBase64.includes(',')) {
      base64Data = pdfBase64.split(',')[1];
    }

    if (!base64Data) {
      throw new Error('PDF data is empty');
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    console.log(
      `📄 PDF Buffer size: ${pdfBuffer.length} bytes (${(
        pdfBuffer.length /
        1024 /
        1024
      ).toFixed(2)} MB)`
    );

    // Email HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Scout ID Card - MSR Rwanda</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 4px solid #FFD100;
          }
          .header h1 {
            color: #002B5C;
            margin: 0;
            font-size: 28px;
          }
          .header .subtitle {
            color: #6B7280;
            font-size: 14px;
            margin-top: 4px;
          }
          .badge {
            display: inline-block;
            background: #FFD100;
            color: #002B5C;
            padding: 4px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 8px;
          }
          .content {
            padding: 30px 0;
          }
          .content h2 {
            color: #002B5C;
            font-size: 22px;
            margin-top: 0;
          }
          .content p {
            color: #374151;
            line-height: 1.6;
            font-size: 15px;
          }
          .card-preview {
            background: #f8f6f0;
            border: 2px solid #FFD100;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .card-preview .sin-number {
            font-size: 28px;
            font-weight: bold;
            color: #002B5C;
            letter-spacing: 2px;
            font-family: 'Courier New', monospace;
          }
          .card-preview .member-name {
            font-size: 18px;
            font-weight: bold;
            color: #1a1a1a;
          }
          .card-preview .member-details {
            font-size: 14px;
            color: #6B7280;
            margin-top: 8px;
          }
          .info-box {
            background: #F9FAFB;
            border-left: 4px solid #FFD100;
            padding: 16px 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-box strong {
            color: #002B5C;
          }
          .btn {
            display: inline-block;
            background: #FFD100;
            color: #002B5C;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 10px 0;
          }
          .btn:hover {
            background: #f5c800;
          }
          .btn-secondary {
            background: #002B5C;
            color: #FFD100;
          }
          .btn-secondary:hover {
            background: #001a3a;
          }
          .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #E5E7EB;
            color: #6B7280;
            font-size: 12px;
          }
          .footer a {
            color: #002B5C;
            text-decoration: none;
          }
          .scout-id-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 15px 0;
            padding: 15px;
            background: #f8f6f0;
            border-radius: 8px;
          }
          .scout-id-details .label {
            font-weight: bold;
            color: #002B5C;
          }
          .scout-id-details .value {
            color: #374151;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏕️ MSR Rwanda</h1>
            <p class="subtitle">MyScout Rwanda - Scout ID Card</p>
            <span class="badge">✅ APPROVED</span>
          </div>

          <div class="content">
            <h2>🎉 Congratulations, ${user?.full_name || member.first_name}!</h2>
            
            <p>Your membership payment has been <strong>approved</strong> and your <strong>Scout ID Card</strong> is now ready!</p>
            
            <div class="card-preview">
              <div style="margin-bottom: 12px;">
                <div style="font-size: 12px; color: #6B7280;">SCOUT IDENTIFICATION NUMBER</div>
                <div class="sin-number">${member.sin}</div>
              </div>
              <div class="member-name">${user?.full_name || `${member.first_name} ${member.last_name}`}</div>
              <div class="member-details">
                ${member.district || ''} ${member.troop_name ? `· ${member.troop_name}` : ''}
              </div>
              <div style="margin-top: 8px; font-size: 12px; color: #6B7280;">
                Issued: ${new Date().toLocaleDateString()}
              </div>
            </div>

            <div class="scout-id-details">
              <div><span class="label">SIN:</span> <span class="value">${member.sin}</span></div>
              <div><span class="label">Name:</span> <span class="value">${user?.full_name || `${member.first_name} ${member.last_name}`}</span></div>
              <div><span class="label">District:</span> <span class="value">${member.district || 'N/A'}</span></div>
              <div><span class="label">Troop:</span> <span class="value">${member.troop_name || 'N/A'}</span></div>
              <div><span class="label">Status:</span> <span class="value">Active</span></div>
              <div><span class="label">Issued:</span> <span class="value">${new Date().toISOString().split('T')[0]}</span></div>
            </div>

            <div class="info-box">
              <strong>📋 What's Next?</strong>
              <ul style="color: #374151; line-height: 1.8; margin: 8px 0 0 0; padding-left: 20px;">
                <li>🔑 Log in to your account to view your full Scout ID Card</li>
                <li>📅 Register for upcoming events and activities</li>
                <li>📚 Enroll in training courses and workshops</li>
                <li>🏆 Track your progress and earn badges</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/dashboard" class="btn">🔑 Go to Dashboard</a>
            </div>

            <p style="font-size: 13px; color: #6B7280; text-align: center;">
              <strong>💡 Keep your SIN safe:</strong> ${member.sin}<br>
              You'll need it for event registration and verification.
            </p>
          </div>

          <div class="footer">
            <p>
              <strong>MSR Rwanda - MyScout Rwanda</strong><br>
              Building better citizens through scouting
            </p>
            <p>
              <a href="${appUrl}/terms">Terms of Service</a> | 
              <a href="${appUrl}/privacy">Privacy Policy</a> | 
              <a href="${appUrl}/support">Support</a>
            </p>
            <p>© ${new Date().getFullYear()} MSR Rwanda. All rights reserved.</p>
            <p style="font-size: 11px; color: #9CA3AF;">
              This email was sent to <a href="mailto:${user?.email}" style="color: #6B7280;">${user?.email}</a>.
              If you did not request this, please ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await sendBrevoEmail({
      to: user?.email,
      subject: `🎫 Your Scout ID Card - ${member.sin} | MSR Rwanda`,
      html: htmlContent,
      attachments: [
        {
          filename: `Scout_ID_${member.sin}.pdf`,
          content: pdfBuffer
        }
      ]
    });

    console.log(
      `📧 Scout ID Card PDF sent to ${user?.email}`
    );

    return {
      success: true,
      messageId: info.messageId,
      to: user?.email
    };
  } catch (error) {
    console.error(
      '❌ Scout ID Card PDF email error:',
      error
    );
    throw error;
  }
}

// ============================================
// SEND SCOUT ID CARD EMAIL
// WITHOUT PDF ATTACHMENT
// ============================================

async function sendScoutIDCardEmail(member) {
  try {
    const user = member.user;

    if (!user || !user.email) {
      throw new Error(
        'No email address found for this member'
      );
    }

    const appUrl =
      process.env.FRONTEND_URL || 'http://localhost:3000';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Scout ID Card - MSR Rwanda</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 4px solid #FFD100;
          }
          .header h1 {
            color: #002B5C;
            margin: 0;
            font-size: 28px;
          }
          .header .subtitle {
            color: #6B7280;
            font-size: 14px;
            margin-top: 4px;
          }
          .badge {
            display: inline-block;
            background: #FFD100;
            color: #002B5C;
            padding: 4px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 8px;
          }
          .content {
            padding: 30px 0;
          }
          .content h2 {
            color: #002B5C;
            font-size: 22px;
            margin-top: 0;
          }
          .content p {
            color: #374151;
            line-height: 1.6;
            font-size: 15px;
          }
          .card-preview {
            background: #f8f6f0;
            border: 2px solid #FFD100;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .card-preview .sin-number {
            font-size: 28px;
            font-weight: bold;
            color: #002B5C;
            letter-spacing: 2px;
            font-family: 'Courier New', monospace;
          }
          .card-preview .member-name {
            font-size: 18px;
            font-weight: bold;
            color: #1a1a1a;
          }
          .card-preview .member-details {
            font-size: 14px;
            color: #6B7280;
            margin-top: 8px;
          }
          .info-box {
            background: #F9FAFB;
            border-left: 4px solid #FFD100;
            padding: 16px 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-box strong {
            color: #002B5C;
          }
          .btn {
            display: inline-block;
            background: #FFD100;
            color: #002B5C;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 10px 0;
          }
          .btn:hover {
            background: #f5c800;
          }
          .btn-secondary {
            background: #002B5C;
            color: #FFD100;
          }
          .btn-secondary:hover {
            background: #001a3a;
          }
          .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #E5E7EB;
            color: #6B7280;
            font-size: 12px;
          }
          .footer a {
            color: #002B5C;
            text-decoration: none;
          }
          .scout-id-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 15px 0;
            padding: 15px;
            background: #f8f6f0;
            border-radius: 8px;
          }
          .scout-id-details .label {
            font-weight: bold;
            color: #002B5C;
          }
          .scout-id-details .value {
            color: #374151;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏕️ MSR Rwanda</h1>
            <p class="subtitle">MyScout Rwanda - Scout ID Card</p>
            <span class="badge">✅ APPROVED</span>
          </div>

          <div class="content">
            <h2>🎉 Congratulations, ${user?.full_name || member.first_name}!</h2>
            
            <p>Your membership payment has been <strong>approved</strong> and your <strong>Scout ID Card</strong> is now ready!</p>
            
            <div class="card-preview">
              <div style="margin-bottom: 12px;">
                <div style="font-size: 12px; color: #6B7280;">SCOUT IDENTIFICATION NUMBER</div>
                <div class="sin-number">${member.sin}</div>
              </div>
              <div class="member-name">${user?.full_name || `${member.first_name} ${member.last_name}`}</div>
              <div class="member-details">
                ${member.district || ''} ${member.troop_name ? `· ${member.troop_name}` : ''}
              </div>
              <div style="margin-top: 8px; font-size: 12px; color: #6B7280;">
                Issued: ${new Date().toLocaleDateString()}
              </div>
            </div>

            <div class="scout-id-details">
              <div><span class="label">SIN:</span> <span class="value">${member.sin}</span></div>
              <div><span class="label">Name:</span> <span class="value">${user?.full_name || `${member.first_name} ${member.last_name}`}</span></div>
              <div><span class="label">District:</span> <span class="value">${member.district || 'N/A'}</span></div>
              <div><span class="label">Troop:</span> <span class="value">${member.troop_name || 'N/A'}</span></div>
              <div><span class="label">Status:</span> <span class="value">Active</span></div>
              <div><span class="label">Issued:</span> <span class="value">${new Date().toISOString().split('T')[0]}</span></div>
            </div>

            <div class="info-box">
              <strong>📋 What's Next?</strong>
              <ul style="color: #374151; line-height: 1.8; margin: 8px 0 0 0; padding-left: 20px;">
                <li>🔑 Log in to your account to view your full Scout ID Card</li>
                <li>📅 Register for upcoming events and activities</li>
                <li>📚 Enroll in training courses and workshops</li>
                <li>🏆 Track your progress and earn badges</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/dashboard" class="btn">🔑 Go to Dashboard</a>
            </div>

            <p style="font-size: 13px; color: #6B7280; text-align: center;">
              <strong>💡 Keep your SIN safe:</strong> ${member.sin}<br>
              You'll need it for event registration and verification.
            </p>
          </div>

          <div class="footer">
            <p>
              <strong>MSR Rwanda - MyScout Rwanda</strong><br>
              Building better citizens through scouting
            </p>
            <p>
              <a href="${appUrl}/terms">Terms of Service</a> | 
              <a href="${appUrl}/privacy">Privacy Policy</a> | 
              <a href="${appUrl}/support">Support</a>
            </p>
            <p>© ${new Date().getFullYear()} MSR Rwanda. All rights reserved.</p>
            <p style="font-size: 11px; color: #9CA3AF;">
              This email was sent to <a href="mailto:${user?.email}" style="color: #6B7280;">${user?.email}</a>.
              If you did not request this, please ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
MSR Rwanda - Scout ID Card

Congratulations ${user?.full_name || member.first_name}!

Your membership payment has been approved and your Scout ID Card is now ready.

Scout ID Number (SIN): ${member.sin}
Name: ${user?.full_name || `${member.first_name} ${member.last_name}`}
District: ${member.district || 'N/A'}
Troop: ${member.troop_name || 'N/A'}
Status: Active
Issued: ${new Date().toISOString().split('T')[0]}

Log in to your account to view your full Scout ID Card:
${appUrl}/dashboard

© ${new Date().getFullYear()} MSR Rwanda
`;

    const info = await sendBrevoEmail({
      to: user?.email,
      subject: `🎫 Your Scout ID Card - ${member.sin} | MSR Rwanda`,
      html: htmlContent,
      text: textContent
    });

    console.log(
      `📧 Scout ID Card email sent to ${user?.email}`
    );

    return {
      success: true,
      messageId: info.messageId,
      to: user?.email
    };
  } catch (error) {
    console.error(
      '❌ Scout ID Card email error:',
      error
    );
    throw error;
  }
}

// ============================================
// BULK EMAILS
// FOR ANNOUNCEMENTS
// ============================================

async function sendBulkEmails(
  recipients,
  announcement,
  author
) {
  try {
    const results = [];

    // Keep the original batch size.
    const batchSize = 50;

    console.log(
      `📧 Sending emails to ${recipients.length} recipients...`
    );

    for (
      let i = 0;
      i < recipients.length;
      i += batchSize
    ) {
      const batch = recipients.slice(
        i,
        i + batchSize
      );

      console.log(
        `📧 Processing batch ${
          Math.floor(i / batchSize) + 1
        } of ${Math.ceil(
          recipients.length / batchSize
        )}`
      );

      const batchResults =
        await Promise.allSettled(
          batch.map((email) =>
            sendAnnouncementEmail(
              email,
              announcement,
              author
            )
          )
        );

      batchResults.forEach((result) => {
        if (
          result.status === 'fulfilled' &&
          result.value
        ) {
          results.push(result.value);
        }
      });

      if (i + batchSize < recipients.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }
    }

    const successCount = results.filter(
      (r) => r?.success
    ).length;

    const failCount = results.filter(
      (r) => r && !r.success
    ).length;

    console.log(
      `📧 Email results: ${successCount} sent, ${failCount} failed`
    );

    return {
      results,
      summary: {
        sent: successCount,
        failed: failCount,
        total: results.length
      }
    };
  } catch (error) {
    console.error(
      '❌ Bulk email error:',
      error
    );
    throw error;
  }
}

// ============================================
// SEND ANNOUNCEMENT EMAIL
// ============================================

async function sendAnnouncementEmail(
  to,
  announcement,
  author
) {
  try {
    const appUrl =
      process.env.FRONTEND_URL ||
      'http://localhost:3000';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FFD100; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; color: #1a1a1a; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .announcement-type { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #f3f4f6; color: #374151; }
          .announcement-type.urgent { background: #fee2e2; color: #991b1b; }
          .announcement-type.important { background: #fef3c7; color: #92400e; }
          .announcement-type.info { background: #dbeafe; color: #1e40af; }
          .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 12px; border-top: 1px solid #e5e7eb; margin-top: 20px; }
          .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; background: #FFD100; color: #1a1a1a; }
          .btn { display: inline-block; padding: 10px 20px; background: #FFD100; color: #1a1a1a; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📢 ${announcement.announcement_type === 'urgent' ? '🚨 URGENT: ' : ''}${announcement.title}</h1>
          </div>
          <div class="content">
            <p>
              <span class="announcement-type ${announcement.announcement_type}">
                ${announcement.announcement_type || 'general'}
              </span>
              <span class="badge">${announcement.district === 'all' ? 'National' : announcement.district}</span>
            </p>
            <div style="margin: 20px 0; white-space: pre-wrap;">
              ${announcement.content}
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6B7280; font-size: 14px;">
              <strong>From:</strong> ${author?.full_name || 'MSR Rwanda'}<br />
              <strong>Date:</strong> ${new Date(announcement.created_at).toLocaleString()}
            </p>
            <a href="${appUrl}/announcements" class="btn">View All Announcements</a>
          </div>
          <div class="footer">
            <p>This is an automated message from MSR Rwanda.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await sendBrevoEmail({
      to,
      subject: `📢 ${announcement.announcement_type === 'urgent' ? '🚨 URGENT: ' : ''}${announcement.title}`,
      html: htmlContent
    });

    console.log(`✅ Email sent to ${to}`);

    return {
      email: to,
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(
      `❌ Failed to send email to ${to}:`,
      error.message
    );

    return {
      email: to,
      success: false,
      error: error.message
    };
  }
}

// ============================================
// ✅ EXPORT ALL FUNCTIONS
// ============================================

module.exports = {
  verifyEmailConnection,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendScoutIDCardEmail,
  sendScoutIDCardPDF,
  sendBulkEmails,
  sendAnnouncementEmail
};