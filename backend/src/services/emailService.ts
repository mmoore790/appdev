import nodemailer = require('nodemailer');
import { Resend } from "resend";
import { storage } from '../storage';
import { format } from 'date-fns';
import { InsertEmailHistory } from '@shared/schema';

// Optional mailersend import - only load if package is installed
let MailerSend: any = null;
let EmailParams: any = null;
let Sender: any = null;
let Recipient: any = null;

try {
  const mailersendModule = require("mailersend");
  MailerSend = mailersendModule.MailerSend;
  EmailParams = mailersendModule.EmailParams;
  Sender = mailersendModule.Sender;
  Recipient = mailersendModule.Recipient;
} catch (e) {
  // mailersend is optional, continue without it
}

export class EmailService {
  private transporter?: nodemailer.Transporter;
  private mailerSend: any = null;
  private resend: Resend | null = null;

  constructor() {
    // Prefer Resend if API key is available
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      console.log("✅ Email service initialized with Resend");
    }
    // Try to use MailerSend next if API key is available
    else if (process.env.MAILERSEND_API_KEY && MailerSend) {
      this.mailerSend = new MailerSend({
        apiKey: process.env.MAILERSEND_API_KEY,
      });
      console.log('✅ Email service initialized with MailerSend');
    }
    // Fallback to SMTP if configured
    else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({ // <-- Add (
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }); // <-- Add )
      console.log('✅ Email service initialized with SMTP');
    }
    // Demo mode if no credentials
    else {
      this.transporter = {
        sendMail: async (options: any) => {
          console.log('📧 Demo mode: Email not sent (no email credentials)');
          return { messageId: 'demo-message-id' };
        }
      } as any;
      console.log('⚠️ Email service in demo mode (no credentials)');
    }
  }

  async sendEmailWithResend(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<any> {
    if (!this.resend) {
      throw new Error("Resend not initialized");
    }

    const fromAddress = `noreply@boltdown.co.uk`;

    try {
      const response = await this.resend.emails.send({
        from: fromAddress,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log(`✅ Email sent successfully via Resend to ${options.to}`);
      return response;
    } catch (error) {
      console.error("❌ Resend error:", error);
      throw error;
    }
  }

  async sendEmailWithMailerSend(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<any> {
    if (!this.mailerSend || !Sender || !Recipient || !EmailParams) {
      throw new Error('MailerSend not initialized or package not installed');
    }

    const sentFrom = new Sender("info@mooresmowers.co.uk", "Moore Horticulture Equipment");
    const recipients = [new Recipient(options.to)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(options.subject)
      .setHtml(options.html)
      .setText(options.text);

    try {
      const response = await this.mailerSend.email.send(emailParams);
      console.log('✅ Email sent successfully via MailerSend');
      return response;
    } catch (error) {
      console.error('❌ MailerSend error:', error);
      throw error;
    }
  }

  getFromAddress(): string {
    // Return default from address based on configured provider
    if (process.env.RESEND_API_KEY) {
      return 'noreply@boltdown.co.uk';
    }
    if (process.env.MAILERSEND_API_KEY) {
      return 'info@mooresmowers.co.uk';
    }
    if (process.env.SMTP_USER) {
      return process.env.SMTP_USER;
    }
    return 'noreply@example.com';
  }

  async sendGenericEmail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<boolean> {
    try {
      // Prefer Resend if configured
      if (this.resend) {
        await this.sendEmailWithResend(options);
        return true;
      }
      // Fallback to MailerSend if configured
      if (this.mailerSend) {
        await this.sendEmailWithMailerSend(options);
        return true;
      }
      // Fallback to SMTP if configured
      if (this.transporter) {
        await this.transporter.sendMail({
          from: options.from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
        return true;
      }
      // Demo mode
      console.log('📧 Demo mode: Email not sent (no email credentials)');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      return false;
    } catch (error) {
      console.error('Error sending generic email:', error);
      return false;
    }
  }
}

/**
 * Helper function to log emails to email history
 * Tries to find customer by email address, but logs even if customer not found
 */
async function logEmailToHistory(params: {
  businessId: number;
  customerEmail: string;
  subject: string;
  body: string;
  emailType: string;
  sentBy?: number | null;
  metadata?: any;
  customerId?: number | null; // Optional - if provided, use it; otherwise try to find by email
}): Promise<void> {
  try {
    let customerId: number | null = params.customerId ?? null;

    // If customerId not provided, try to find customer by email
    if (!customerId && params.customerEmail) {
      try {
        const customer = await storage.getCustomerByEmail(params.customerEmail, params.businessId);
        if (customer) {
          customerId = customer.id;
        }
      } catch (error) {
        // If customer lookup fails, continue with null customerId
        console.warn(`Could not find customer by email ${params.customerEmail}:`, error);
      }
    }

    // Log email to history (customerId can be null)
    // Normalize email to lowercase for consistency
    await storage.createEmailHistory({
      businessId: params.businessId,
      customerId: customerId ?? null,
      customerEmail: params.customerEmail.toLowerCase(),
      subject: params.subject,
      body: params.body,
      emailType: params.emailType,
      sentBy: params.sentBy ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    // Don't fail email sending if history logging fails
    console.error('Failed to log email to history:', error);
  }
}

// Export individual functions for backward compatibility
const emailService = new EmailService();

export async function sendEmail(apiKey: string, params: any): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendEmail called with:', apiKey, params);
  return false;
}

export async function sendSupportMessageNotificationEmail(params: {
  to: string;
  senderName: string;
  senderEmail: string;
  senderBusinessId: number;
  content: string;
  sentAt: string;
}): Promise<boolean> {
  try {
    const emailService = new EmailService();
    const fromAddress = emailService.getFromAddress();
    const subject = "BoltDown support: New message from " + params.senderName;
    const formattedDate = format(new Date(params.sentAt), "PPpp");
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #22c55e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
    .detail { margin: 8px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .message-box { background: white; padding: 16px; border-radius: 8px; margin-top: 12px; border-left: 4px solid #22c55e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>BoltDown Support - New Message</h1>
    </div>
    <div class="content">
      <p>A user has sent a message via the BoltDown support chat.</p>
      <div class="detail"><span class="label">From:</span> ${params.senderName}</div>
      <div class="detail"><span class="label">Email:</span> ${params.senderEmail}</div>
      <div class="detail"><span class="label">Business ID:</span> ${params.senderBusinessId}</div>
      <div class="detail"><span class="label">Sent:</span> ${formattedDate}</div>
      <div class="message-box">
        <p class="label" style="margin-bottom: 8px;">Message:</p>
        <p style="white-space: pre-wrap; margin: 0;">${params.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>
      <p style="margin-top: 16px; font-size: 12px; color: #6b7280;">Log in to BoltDown to view and respond to this message.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
    const text = `BoltDown Support - New Message\n\nFrom: ${params.senderName}\nEmail: ${params.senderEmail}\nBusiness ID: ${params.senderBusinessId}\nSent: ${formattedDate}\n\nMessage:\n${params.content}`;
    await emailService.sendGenericEmail({
      from: fromAddress,
      to: params.to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("sendSupportMessageNotificationEmail error:", error);
    return false;
  }
}

export async function sendRegistrationApprovalEmail(to: string, fullName: string, username: string): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendRegistrationApprovalEmail called', { to, fullName, username });
  return false;
}

export async function sendJobReceiptEmail(customerEmail: string, jobDetails: any): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendJobReceiptEmail called');
  return false;
}

export async function sendJobReadyForPickupEmail(customerEmail: string, jobDetails: any): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendJobReadyForPickupEmail called');
  return false;
}

export async function sendRegistrationRejectionEmail(to: string, fullName: string, reason?: string): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendRegistrationRejectionEmail called', { to, fullName, reason });
  return false;
}

export async function sendPasswordResetCodeEmail(to: string, fullName: string, code: string, business?: any): Promise<boolean> {
  try {
    const emailService = new EmailService();
    const fromAddress = emailService.getFromAddress();
    
    const emailContent = generatePasswordResetHTML(fullName, code, business);
    const textContent = generatePasswordResetText(fullName, code, business);
    
    const subject = "Password Reset Code";

    await emailService.sendGenericEmail({
      from: fromAddress,
      to: to,
      subject,
      text: textContent,
      html: emailContent,
    });
    
    return true;
  } catch (error) {
    console.error('Error in sendPasswordResetCodeEmail:', error);
    return false;
  }
}

function generatePasswordResetHTML(fullName: string, code: string, business?: any): string {
  // Get company details from business settings, with fallbacks
  const companyName = business?.name || 'Moore Horticulture Equipment';
  const companyEmail = business?.email || 'info@mooresmowers.co.uk';
  const companyPhone = business?.phone || '02897510804';
  const companyAddress = business?.address || '9 Drumalig Road, BT27 6UD';
  
  // Get customer name
  const customerName = fullName || 'Valued Customer';
  
  // Escape HTML to prevent XSS
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return '';
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };
  
  return `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]--><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="format-detection" content="telephone=no, date=no, address=no, email=no" /><meta name="x-apple-disable-message-reformatting" /><link href="https://fonts.googleapis.com/css?family=Fira+Sans:ital,wght@0,400;0,800" rel="stylesheet" /><title>Password Reset Code</title><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmojLazX3dGTP.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvk4jLazX3dGTP.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmYjLazX3dGTP.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvl4jLazX3dA.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}</style><!--<![endif]--><style>html,body{margin:0 !important;padding:0 !important;min-height:100% !important;width:100% !important;-webkit-font-smoothing:antialiased;}*{-ms-text-size-adjust:100%;}#outlook a{padding:0;}.ReadMsgBody,.ExternalClass{width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass td,.ExternalClass div,.ExternalClass span,.ExternalClass font{line-height:100%;}table,td,th{mso-table-lspace:0 !important;mso-table-rspace:0 !important;border-collapse:collapse;}u + .body table,u + .body td,u + .body th{will-change:transform;}body,td,th,p,div,li,a,span{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;mso-line-height-rule:exactly;}img{border:0;outline:0;line-height:100%;text-decoration:none;-ms-interpolation-mode:bicubic;}a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}.body .pc-project-body{background-color:transparent !important;}@media (min-width:621px){.pc-lg-hide{display:none;}.pc-lg-bg-img-hide{background-image:none !important;}}</style><style>@media (max-width:620px){.pc-project-body{min-width:0 !important;}.pc-project-container,.pc-component{width:100% !important;}.pc-sm-hide{display:none !important;}.pc-sm-bg-img-hide{background-image:none !important;}.pc-w620-font-size-30px{font-size:30px !important;}.pc-w620-line-height-133pc{line-height:133% !important;}.pc-w620-padding-32-35-32-35{padding:32px 35px !important;}.pc-w620-padding-10-35-10-35{padding:10px 35px !important;}.pc-w620-padding-35-35-35-35{padding:35px !important;}}@media (max-width:520px){.pc-w520-padding-27-30-27-30{padding:27px 30px !important;}.pc-w520-padding-10-30-10-30{padding:10px 30px !important;}.pc-w520-padding-30-30-30-30{padding:30px !important;}}</style><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;src:url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf8.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf6.woff2') format('woff2');}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjN.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjL.woff2') format('woff2');}</style><!--<![endif]--><!--[if mso]><style type="text/css">.pc-font-alt{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body class="body pc-font-alt" style="width:100% !important;min-height:100% !important;margin:0 !important;padding:0 !important;mso-line-height-rule:exactly;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-variant-ligatures:normal;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;background-color:#f4f4f4" bgcolor="#f4f4f4"><table class="pc-project-body" style="table-layout:fixed;width:100%;min-width:600px;background-color:#f4f4f4" bgcolor="#f4f4f4" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" valign="top" style="width:auto"><table class="pc-project-container" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 0" align="left" valign="top"><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><!--[if !gte mso 9]><!-- --><td valign="top" class="pc-w520-padding-27-30-27-30 pc-w620-padding-32-35-32-35" style="padding:37px 40px;height:unset;background-color:#1B1B1B" bgcolor="#1B1B1B"><!--<![endif]--><!--[if gte mso 9]><td valign="top" align="center" style="background-color:#1B1B1B;border-radius:0" bgcolor="#1B1B1B"><![endif]--><!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px"><v:fill color="#1B1B1B" type="frame"/><v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0"><div style="font-size:0;line-height:0"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td colspan="3" height="37" style="line-height:1px;font-size:1px">&nbsp;</td></tr><tr><td width="40" valign="top" style="line-height:1px;font-size:1px">&nbsp;</td><td valign="top" align="left"><![endif]--><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div class="pc-w620-font-size-30px pc-w620-line-height-133pc" style="font-size:36px;line-height:128%;text-align:left;text-align-last:left;color:#fff;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.6px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:36px;line-height:128%;font-weight:800" class="pc-w620-font-size-30px pc-w620-line-height-133pc">Password Reset Code</span></div></div></div></td></tr></table><!--[if gte mso 9]></td><td width="40" style="line-height:1px;font-size:1px" valign="top">&nbsp;</td></tr><tr><td colspan="3" height="37" style="line-height:1px;font-size:1px">&nbsp;</td></tr></table></td></tr></table></div><p style="margin:0;mso-hide:all"><o:p xmlns:o="urn:schemas-microsoft-com:office:office">&nbsp;</o:p></p></v:textbox></v:rect><![endif]--></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-10-30-10-30 pc-w620-padding-10-35-10-35" style="padding:10px 40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left"><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Hi, ${escapeHtml(customerName)}</span></div><div><br></div><div><br></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">We received a request to reset your password. Use the code below to verify your identity and create a new password:</span></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal;text-align:center;padding:20px 0"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:32px;line-height:140%;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;color:#1B1B1B">${code}</span></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">This code will expire in 15 minutes. If you didn't request a password reset, please ignore this email.</span></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Enter this code on the password reset page to continue with resetting your password.</span></div><div><br></div><div><br></div></div></div></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-30-30-30-30 pc-w620-padding-35-35-35-35" style="padding:40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="top"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" align="left"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left;color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Kind Regards,</span></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyName)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyAddress)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyEmail)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyPhone)}</span></div><div><br></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">THIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.</span></div></div></div></td></tr></table></td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>`;
}

function generatePasswordResetText(fullName: string, code: string, business?: any): string {
  // Get company details from business settings, with fallbacks
  const companyName = business?.name || 'Moore Horticulture Equipment';
  const companyEmail = business?.email || 'info@mooresmowers.co.uk';
  const companyPhone = business?.phone || '02897510804';
  const companyAddress = business?.address || '9 Drumalig Road, BT27 6UD';
  
  // Get customer name
  const customerName = fullName || 'Valued Customer';
  
  return `
${companyName.toUpperCase()}
PASSWORD RESET CODE

Dear ${customerName},

We received a request to reset your password. Use the code below to verify your identity and create a new password:

${code}

IMPORTANT: This code will expire in 15 minutes. If you didn't request a password reset, please ignore this email.

Enter this code on the password reset page to continue with resetting your password.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

Kind Regards,
${companyName}
${companyAddress}
${companyEmail}
${companyPhone}

THIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.
  `.trim();
}

export async function sendJobBookedEmail(job: any, customer: any, business?: any): Promise<boolean> {
  try {
    if (!customer.email) {
      console.log('No customer email provided, skipping job receipt email');
      return false;
    }

    const emailContent = generateJobBookedHTML(job, customer, business);
    const textContent = generateJobBookedText(job, customer, business);

    const subject = `Job Booked - ${job.jobId}`;
    const businessId = job.businessId || business?.id;

    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithResend({
        from: "noreply@boltdown.co.uk",
        to: customer.email,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Job booked email sent successfully via Resend to ${customer.name} (${customer.email})`);
      
      // Log to email history
      if (businessId) {
        await logEmailToHistory({
          businessId,
          customerEmail: customer.email,
          subject,
          body: textContent,
          emailType: 'job_booked',
          customerId: customer.id || null,
          metadata: { jobId: job.jobId, jobId_db: job.id },
        });
      }
      
      return true;
    }

    // Fallback to MailerSend if configured
    if (process.env.MAILERSEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithMailerSend({
        from: "noreply@boltdown.co.uk",
        to: customer.email,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Job booked email sent successfully via MailerSend to ${customer.name} (${customer.email})`);
      
      // Log to email history
      if (businessId) {
        await logEmailToHistory({
          businessId,
          customerEmail: customer.email,
          subject,
          body: textContent,
          emailType: 'job_booked',
          customerId: customer.id || null,
          metadata: { jobId: job.jobId, jobId_db: job.id },
        });
      }
      
      return true;
    }

    // Fallback to demo mode
    console.log(`\n📧 === JOB BOOKED NOTIFICATION (DEMO MODE) ===`);
    console.log(`To: ${customer.email}`);
    console.log(`Customer: ${customer.name}`);
    console.log(`Job ID: ${job.jobId}`);
    console.log(`Equipment: ${job.equipmentDescription || 'N/A'}`);
    console.log(`Phone: ${customer.phone || 'N/A'}`);
    
    console.log('\n--- EMAIL CONTENT (TEXT VERSION) ---');
    console.log(textContent);
    console.log('\n--- EMAIL CONTENT (HTML VERSION) ---');
    console.log('✅ Professional HTML email generated with:');
    console.log(`   • Company branding and responsive design`);
    console.log(`   • Job details and equipment information`);
    console.log(`   • Contact details for customer convenience`);
    console.log(`   • Email size: ${emailContent.length} characters`);
    console.log('============================================\n');
    
    // Log to email history even in demo mode
    if (businessId) {
      await logEmailToHistory({
        businessId,
        customerEmail: customer.email,
        subject,
        body: textContent,
        emailType: 'job_booked',
        customerId: customer.id || null,
        metadata: { jobId: job.jobId, jobId_db: job.id },
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error in sendJobBookedEmail:', error);
    return false;
  }
}

export async function sendJobCompletedEmail(job: any, customer: any, business?: any): Promise<boolean> {
  try {
    if (!customer.email) {
      console.log('No customer email provided, skipping job ready for collection email');
      return false;
    }

    const emailContent = generateJobReadyForCollectionHTML(job, customer, business);
    const textContent = generateJobReadyForCollectionText(job, customer, business);

    const subject = `Your Equipment is Ready for Collection - ${job.jobId}`;
    const businessId = job.businessId || business?.id;

    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithResend({
        from: "noreply@boltdown.co.uk",
        to: customer.email,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Job ready for collection email sent successfully via Resend to ${customer.name} (${customer.email})`);
      
      // Log to email history
      if (businessId) {
        await logEmailToHistory({
          businessId,
          customerEmail: customer.email,
          subject,
          body: textContent,
          emailType: 'job_ready_for_collection',
          customerId: customer.id || null,
          metadata: { jobId: job.jobId, jobId_db: job.id },
        });
      }
      
      return true;
    }

    // Fallback to MailerSend if configured
    if (process.env.MAILERSEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithMailerSend({
        from: "noreply@boltdown.co.uk",
        to: customer.email,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Job ready for collection email sent successfully via MailerSend to ${customer.name} (${customer.email})`);
      
      // Log to email history
      if (businessId) {
        await logEmailToHistory({
          businessId,
          customerEmail: customer.email,
          subject,
          body: textContent,
          emailType: 'job_ready_for_collection',
          customerId: customer.id || null,
          metadata: { jobId: job.jobId, jobId_db: job.id },
        });
      }
      
      return true;
    }

    // Fallback to demo mode
    console.log(`\n📧 === JOB READY FOR COLLECTION NOTIFICATION (DEMO MODE) ===`);
    console.log(`To: ${customer.email}`);
    console.log(`Customer: ${customer.name}`);
    console.log(`Job ID: ${job.jobId}`);
    console.log(`Equipment: ${job.equipmentDescription || 'N/A'}`);
    
    console.log('\n--- EMAIL CONTENT (TEXT VERSION) ---');
    console.log(textContent);
    console.log('\n--- EMAIL CONTENT (HTML VERSION) ---');
    console.log('✅ Professional HTML email generated with:');
    console.log(`   • Company branding and responsive design`);
    console.log(`   • Job details and equipment information`);
    console.log(`   • Contact details for customer convenience`);
    console.log(`   • Email size: ${emailContent.length} characters`);
    console.log('============================================\n');
    
    // Log to email history even in demo mode
    if (businessId) {
      await logEmailToHistory({
        businessId,
        customerEmail: customer.email,
        subject,
        body: textContent,
        emailType: 'job_ready_for_collection',
        customerId: customer.id || null,
        metadata: { jobId: job.jobId, jobId_db: job.id },
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error in sendJobCompletedEmail:', error);
    return false;
  }
}

export async function sendPaymentRequestEmail(
  customerEmail: string,
  paymentLink: string,
  description: string,
  amount: string,
  checkoutReference: string
): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendPaymentRequestEmail called', {
    customerEmail,
    paymentLink,
    description,
    amount,
    checkoutReference
  });
  return false;
}

export async function sendPaymentRequestEmailNoLink(
  customerEmail: string,
  description: string,
  amount: string,
  checkoutReference: string
): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendPaymentRequestEmailNoLink called', {
    customerEmail,
    description,
    amount,
    checkoutReference
  });
  return false;
}

export async function sendPartReadyEmail(part: any): Promise<boolean> {
  try {
    const emailContent = generatePartReadyHTML(part);
    const textContent = generatePartReadyText(part);

    const subject = `Part Ready for Collection - ${part.partName}`;
    const businessId = part.businessId;

    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithResend({
        from: "noreply@boltdown.co.uk",
        to: part.customerEmail,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Part ready email sent successfully via Resend to ${part.customerName} (${part.customerEmail})`);
      
      // Log to email history
      if (businessId) {
        await logEmailToHistory({
          businessId,
          customerEmail: part.customerEmail,
          subject,
          body: textContent,
          emailType: 'part_ready',
          customerId: part.customerId ?? null,
          metadata: { partName: part.partName, partNumber: part.partNumber },
        });
      }
      
      return true;
    }

    // Fallback to MailerSend if configured
    if (process.env.MAILERSEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithMailerSend({
        from: "noreply@boltdown.co.uk",
        to: part.customerEmail,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Part ready email sent successfully via MailerSend to ${part.customerName} (${part.customerEmail})`);
      
      // Log to email history
      if (businessId) {
        await logEmailToHistory({
          businessId,
          customerEmail: part.customerEmail,
          subject,
          body: textContent,
          emailType: 'part_ready',
          customerId: part.customerId ?? null,
          metadata: { partName: part.partName, partNumber: part.partNumber },
        });
      }
      
      return true;
    }

    // Fallback to demo mode
    console.log(`\n📧 === PART READY NOTIFICATION (DEMO MODE) ===`);
    console.log(`To: ${part.customerEmail}`);
    console.log(`Customer: ${part.customerName}`);
    console.log(`Part: ${part.partName}${part.partNumber ? ` (${part.partNumber})` : ''}`);
    console.log(`Supplier: ${part.supplier}`);
    console.log(`Phone: ${part.customerPhone}`);
    
    console.log('\n--- EMAIL CONTENT (TEXT VERSION) ---');
    console.log(textContent);
    console.log('\n--- EMAIL CONTENT (HTML VERSION) ---');
    console.log('✅ Professional HTML email generated with:');
    console.log(`   • Company branding and responsive design`);
    console.log(`   • Part details and collection information`);
    console.log(`   • Contact details for customer convenience`);
    console.log(`   • Email size: ${emailContent.length} characters`);
    console.log('============================================\n');
    
    // Log to email history even in demo mode
    if (businessId) {
      await logEmailToHistory({
        businessId,
        customerEmail: part.customerEmail,
        subject,
        body: textContent,
        emailType: 'part_ready',
        customerId: part.customerId ?? null,
        metadata: { partName: part.partName, partNumber: part.partNumber },
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error in sendPartReadyEmail:', error);
    return false;
  }
}

function generatePartReadyHTML(part: any): string {
  const currentDate = format(new Date(), 'EEEE, MMMM do, yyyy');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Part Ready for Collection</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2d5a2d; }
        .logo { color: #2d5a2d; font-size: 28px; font-weight: bold; margin-bottom: 5px; }
        .tagline { color: #666; font-size: 14px; }
        .success-badge { background-color: #d4edda; color: #155724; padding: 12px; border-radius: 6px; margin-bottom: 25px; text-align: center; font-weight: bold; }
        .part-details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 25px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .detail-label { font-weight: bold; color: #2d5a2d; }
        .detail-value { color: #333; }
        .collection-info { background-color: #e7f3ff; padding: 20px; border-radius: 6px; margin-bottom: 25px; border-left: 4px solid #007bff; }
        .contact-info { background-color: #fff3cd; padding: 20px; border-radius: 6px; margin-bottom: 25px; border-left: 4px solid #ffc107; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        .important { color: #dc3545; font-weight: bold; }
        @media only screen and (max-width: 600px) {
            .container { padding: 15px; }
            .detail-row { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">MOORE HORTICULTURE EQUIPMENT</div>
            <div class="tagline">Professional Equipment Sales & Service</div>
        </div>

        <div class="success-badge">
            🎉 Your Part is Ready for Collection!
        </div>

        <p>Dear ${part.customerName},</p>

        <p>Great news! The part you ordered has arrived and is now ready for collection from our workshop.</p>

        <div class="part-details">
            <h3 style="margin-top: 0; color: #2d5a2d;">Part Details</h3>
            <div class="detail-row">
                <span class="detail-label">Part Name:</span>
                <span class="detail-value">${part.partName}</span>
            </div>
            ${part.partNumber ? `
            <div class="detail-row">
                <span class="detail-label">Part Number:</span>
                <span class="detail-value">${part.partNumber}</span>
            </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Supplier:</span>
                <span class="detail-value">${part.supplier}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Quantity:</span>
                <span class="detail-value">${part.quantity}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Order Date:</span>
                <span class="detail-value">${format(new Date(part.orderDate), 'MMMM do, yyyy')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Arrived:</span>
                <span class="detail-value">${format(new Date(part.actualDeliveryDate), 'MMMM do, yyyy')}</span>
            </div>
        </div>

        <div class="collection-info">
            <h3 style="margin-top: 0; color: #007bff;">Collection Information</h3>
            <p><strong>Workshop Address:</strong><br>
            Moore Horticulture Equipment<br>
            [Your Workshop Address]<br>
            [City, Postal Code]</p>
            
            <p><strong>Opening Hours:</strong><br>
            Monday - Friday: 8:00 AM - 5:00 PM<br>
            Saturday: 8:00 AM - 12:00 PM<br>
            Sunday: Closed</p>
            
            <p class="important">Please bring a form of identification when collecting your part.</p>
        </div>

        <div class="contact-info">
            <h3 style="margin-top: 0; color: #ffc107;">Need to Arrange Collection?</h3>
            <p>If you need to arrange a specific collection time or have any questions, please don't hesitate to contact us:</p>
            <p><strong>Phone:</strong> [Your Phone Number]<br>
            <strong>Email:</strong> info@mooresmowers.co.uk</p>
        </div>

        <p>Thank you for choosing Moore Horticulture Equipment for your parts needs. We look forward to seeing you soon!</p>

        <p>Best regards,<br>
        <strong>The Moore Horticulture Team</strong></p>

        <div class="footer">
            <p>This email was sent automatically from the Moore Horticulture Equipment Management System on ${currentDate}.</p>
            <p>If you believe you received this email in error, please contact us immediately.</p>
        </div>
    </div>
</body>
</html>
  `;
}

function generatePartReadyText(part: any): string {
  const currentDate = format(new Date(), 'EEEE, MMMM do, yyyy');
  
  return `
MOORE HORTICULTURE EQUIPMENT
Professional Equipment Sales & Service

PART READY FOR COLLECTION

Dear ${part.customerName},

Great news! The part you ordered has arrived and is now ready for collection from our workshop.

PART DETAILS:
- Part Name: ${part.partName}
${part.partNumber ? `- Part Number: ${part.partNumber}\n` : ''}- Supplier: ${part.supplier}
- Quantity: ${part.quantity}
- Order Date: ${format(new Date(part.orderDate), 'MMMM do, yyyy')}
- Arrived: ${format(new Date(part.actualDeliveryDate), 'MMMM do, yyyy')}

COLLECTION INFORMATION:
Workshop Address:
Moore Horticulture Equipment
[Your Workshop Address]
[City, Postal Code]

Opening Hours:
Monday - Friday: 8:00 AM - 5:00 PM
Saturday: 8:00 AM - 12:00 PM  
Sunday: Closed

IMPORTANT: Please bring a form of identification when collecting your part.

NEED TO ARRANGE COLLECTION?
If you need to arrange a specific collection time or have any questions:
Phone: [Your Phone Number]
Email: info@mooresmowers.co.uk

Thank you for choosing Moore Horticulture Equipment for your parts needs. We look forward to seeing you soon!

Best regards,
The Moore Horticulture Team

---
This email was sent automatically from the Moore Horticulture Equipment Management System on ${currentDate}.
If you believe you received this email in error, please contact us immediately.
  `;
}

function generateJobBookedHTML(job: any, customer: any, business?: any): string {
  // Get company details from business settings, with fallbacks
  const companyName = business?.name || 'Moore Horticulture Equipment';
  const companyEmail = business?.email || 'info@mooresmowers.co.uk';
  const companyPhone = business?.phone || '02897510804';
  const companyAddress = business?.address || '9 Drumalig Road, BT27 6UD';
  
  // Get equipment make and model
  const equipmentMake = job.equipmentMake || '';
  const equipmentModel = job.equipmentModel || '';
  const equipmentMakeModel = [equipmentMake, equipmentModel].filter(Boolean).join(' ').trim() || job.equipmentDescription || 'equipment';
  
  // Get customer name
  const customerName = customer.name || 'Valued Customer';
  
  // Get job number
  const jobNumber = job.jobId || '';
  
  // Escape HTML to prevent XSS
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return '';
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };
  
  return `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]--><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="format-detection" content="telephone=no, date=no, address=no, email=no" /><meta name="x-apple-disable-message-reformatting" /><link href="https://fonts.googleapis.com/css?family=Fira+Sans:ital,wght@0,400;0,800" rel="stylesheet" /><title>Job Confirmation - ${escapeHtml(jobNumber)}</title><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmojLazX3dGTP.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvk4jLazX3dGTP.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmYjLazX3dGTP.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvl4jLazX3dA.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}</style><!--<![endif]--><style>html,body{margin:0 !important;padding:0 !important;min-height:100% !important;width:100% !important;-webkit-font-smoothing:antialiased;}*{-ms-text-size-adjust:100%;}#outlook a{padding:0;}.ReadMsgBody,.ExternalClass{width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass td,.ExternalClass div,.ExternalClass span,.ExternalClass font{line-height:100%;}table,td,th{mso-table-lspace:0 !important;mso-table-rspace:0 !important;border-collapse:collapse;}u + .body table,u + .body td,u + .body th{will-change:transform;}body,td,th,p,div,li,a,span{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;mso-line-height-rule:exactly;}img{border:0;outline:0;line-height:100%;text-decoration:none;-ms-interpolation-mode:bicubic;}a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}.body .pc-project-body{background-color:transparent !important;}@media (min-width:621px){.pc-lg-hide{display:none;}.pc-lg-bg-img-hide{background-image:none !important;}}</style><style>@media (max-width:620px){.pc-project-body{min-width:0 !important;}.pc-project-container,.pc-component{width:100% !important;}.pc-sm-hide{display:none !important;}.pc-sm-bg-img-hide{background-image:none !important;}.pc-w620-font-size-30px{font-size:30px !important;}.pc-w620-line-height-133pc{line-height:133% !important;}.pc-w620-padding-32-35-32-35{padding:32px 35px !important;}.pc-w620-padding-10-35-10-35{padding:10px 35px !important;}.pc-w620-padding-35-35-35-35{padding:35px !important;}}@media (max-width:520px){.pc-w520-padding-27-30-27-30{padding:27px 30px !important;}.pc-w520-padding-10-30-10-30{padding:10px 30px !important;}.pc-w520-padding-30-30-30-30{padding:30px !important;}}</style><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;src:url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf8.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf6.woff2') format('woff2');}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjN.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjL.woff2') format('woff2');}</style><!--<![endif]--><!--[if mso]><style type="text/css">.pc-font-alt{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body class="body pc-font-alt" style="width:100% !important;min-height:100% !important;margin:0 !important;padding:0 !important;mso-line-height-rule:exactly;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-variant-ligatures:normal;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;background-color:#f4f4f4" bgcolor="#f4f4f4"><table class="pc-project-body" style="table-layout:fixed;width:100%;min-width:600px;background-color:#f4f4f4" bgcolor="#f4f4f4" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" valign="top" style="width:auto"><table class="pc-project-container" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 0" align="left" valign="top"><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><!--[if !gte mso 9]><!-- --><td valign="top" class="pc-w520-padding-27-30-27-30 pc-w620-padding-32-35-32-35" style="padding:37px 40px;height:unset;background-color:#1B1B1B" bgcolor="#1B1B1B"><!--<![endif]--><!--[if gte mso 9]><td valign="top" align="center" style="background-color:#1B1B1B;border-radius:0" bgcolor="#1B1B1B"><![endif]--><!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px"><v:fill color="#1B1B1B" type="frame"/><v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0"><div style="font-size:0;line-height:0"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td colspan="3" height="37" style="line-height:1px;font-size:1px">&nbsp;</td></tr><tr><td width="40" valign="top" style="line-height:1px;font-size:1px">&nbsp;</td><td valign="top" align="left"><![endif]--><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div class="pc-w620-font-size-30px pc-w620-line-height-133pc" style="font-size:36px;line-height:128%;text-align:left;text-align-last:left;color:#fff;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.6px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:36px;line-height:128%;font-weight:800" class="pc-w620-font-size-30px pc-w620-line-height-133pc">Your Job Confirmation</span></div></div></div></td></tr></table><!--[if gte mso 9]></td><td width="40" style="line-height:1px;font-size:1px" valign="top">&nbsp;</td></tr><tr><td colspan="3" height="37" style="line-height:1px;font-size:1px">&nbsp;</td></tr></table></td></tr></table></div><p style="margin:0;mso-hide:all"><o:p xmlns:o="urn:schemas-microsoft-com:office:office">&nbsp;</o:p></p></v:textbox></v:rect><![endif]--></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-10-30-10-30 pc-w620-padding-10-35-10-35" style="padding:10px 40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left"><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Hi, ${escapeHtml(customerName)}</span></div><div><br></div><div><br></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">This email confirms that we have accepted the service or repair of your ${escapeHtml(equipmentMakeModel)}.</span></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">You have been assigned Job number ${escapeHtml(jobNumber)}. We will be in touch again when your machine is ready to collect. </span></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Should you require any further assistance, please don't hesitate to get in touch, referencing the Job number provided above.</span></div><div><br></div><div><br></div></div></div></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-30-30-30-30 pc-w620-padding-35-35-35-35" style="padding:40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="top"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" align="left"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left;color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Kind Regards,</span></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyName)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyAddress)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyEmail)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyPhone)}</span></div><div><br></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">THIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.</span></div></div></div></td></tr></table></td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>`;
}

function generateJobBookedText(job: any, customer: any, business?: any): string {
  const currentDate = format(new Date(), 'EEEE, MMMM do, yyyy');
  const createdDate = job.createdAt ? format(new Date(job.createdAt), 'MMMM do, yyyy') : currentDate;
  const trackerEnabled = business?.jobTrackerEnabled !== false; // Default to true if not set
  
  // Get company details from business settings, with fallbacks
  const companyName = business?.name || 'Moore Horticulture Equipment';
  const companyEmail = business?.email || 'info@mooresmowers.co.uk';
  const companyPhone = business?.phone || '02897510804';
  const companyAddress = business?.address || '9 Drumalig Road, BT27 6UD';
  const companyWebsite = business?.website || '';
  
  // Format status for display
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'waiting_assessment': 'Waiting Assessment',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'on_hold': 'On Hold',
      'cancelled': 'Cancelled'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  };
  
  // Build job tracker URL if enabled
  const trackerUrl = trackerEnabled && companyWebsite 
    ? `${companyWebsite}/job-tracker?jobId=${encodeURIComponent(job.jobId)}&email=${encodeURIComponent(customer.email)}`
    : '';
  
  return `
${companyName.toUpperCase()}
Professional Equipment Sales & Service

JOB SUCCESSFULLY BOOKED - MACHINE RECEIVED

Dear ${customer.name},

Thank you for choosing ${companyName}. We have successfully received your ${job.equipmentDescription ? 'equipment' : 'machine'} and your service job has been booked into our system.

JOB DETAILS:
- Job Reference: ${job.jobId}
- Booking Date: ${createdDate}
- Status: ${formatStatus(job.status)}
${job.description ? `- Description: ${job.description}\n` : ''}

EQUIPMENT RECEIVED:
- Equipment: ${job.equipmentDescription || 'To be assessed upon inspection'}
${job.taskDetails ? `- Work Required: ${job.taskDetails}\n` : ''}

CUSTOMER INFORMATION:
- Name: ${customer.name}
${customer.phone ? `- Phone: ${customer.phone}\n` : ''}
${customer.address ? `- Address: ${customer.address}\n` : ''}
- Email: ${customer.email}

WHAT HAPPENS NEXT?
Our experienced team will now:
- Thoroughly assess your equipment
- Identify any issues or required maintenance
- Contact you with a detailed quote for any work needed
- Keep you updated on the progress of your job

IMPORTANT: Please keep your Job Reference (${job.jobId}) for future reference.

${trackerEnabled && trackerUrl ? `TRACK YOUR JOB ONLINE:\nYou can track the progress of your job anytime using our online job tracker:\n${trackerUrl}\n\n` : ''}
NEED TO CONTACT US?
If you have any questions or need to provide additional information:
Phone: ${companyPhone}
Email: ${companyEmail}
${companyAddress ? `Address: ${companyAddress}\n` : ''}
${companyWebsite ? `Website: ${companyWebsite}\n` : ''}

Thank you for choosing ${companyName}. We look forward to serving you and getting your equipment back in perfect working order!

Best regards,
The ${companyName} Team

---
This email was sent automatically from the ${companyName} Management System on ${currentDate}.
If you believe you received this email in error, please contact us immediately.
  `;
}

function generateJobReadyForCollectionHTML(job: any, customer: any, business?: any): string {
  // Get company details from business settings, with fallbacks
  const companyName = business?.name || 'Moore Horticulture Equipment';
  const companyEmail = business?.email || 'info@mooresmowers.co.uk';
  const companyPhone = business?.phone || '02897510804';
  const companyAddress = business?.address || '9 Drumalig Road, BT27 6UD';
  const companyWebsite = business?.website || '';
  
  // Get equipment make and model
  const equipmentMake = job.equipmentMake || '';
  const equipmentModel = job.equipmentModel || '';
  const equipmentMakeModel = [equipmentMake, equipmentModel].filter(Boolean).join(' ').trim() || job.equipmentDescription || 'equipment';
  
  // Get customer name
  const customerName = customer.name || 'Valued Customer';
  
  // Escape HTML to prevent XSS
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return '';
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };
  
  return `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]--><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="format-detection" content="telephone=no, date=no, address=no, email=no" /><meta name="x-apple-disable-message-reformatting" /><link href="https://fonts.googleapis.com/css?family=Fira+Sans:ital,wght@0,400;0,800" rel="stylesheet" /><title>Equipment Ready for Collection</title><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmojLazX3dGTP.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvk4jLazX3dGTP.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmYjLazX3dGTP.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvl4jLazX3dA.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}</style><!--<![endif]--><style>html,body{margin:0 !important;padding:0 !important;min-height:100% !important;width:100% !important;-webkit-font-smoothing:antialiased;}*{-ms-text-size-adjust:100%;}#outlook a{padding:0;}.ReadMsgBody,.ExternalClass{width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass td,.ExternalClass div,.ExternalClass span,.ExternalClass font{line-height:100%;}table,td,th{mso-table-lspace:0 !important;mso-table-rspace:0 !important;border-collapse:collapse;}u + .body table,u + .body td,u + .body th{will-change:transform;}body,td,th,p,div,li,a,span{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;mso-line-height-rule:exactly;}img{border:0;outline:0;line-height:100%;text-decoration:none;-ms-interpolation-mode:bicubic;}a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}.body .pc-project-body{background-color:transparent !important;}@media (min-width:621px){.pc-lg-hide{display:none;}.pc-lg-bg-img-hide{background-image:none !important;}}</style><style>@media (max-width:620px){.pc-project-body{min-width:0 !important;}.pc-project-container,.pc-component{width:100% !important;}.pc-sm-hide{display:none !important;}.pc-sm-bg-img-hide{background-image:none !important;}.pc-w620-font-size-30px{font-size:30px !important;}.pc-w620-line-height-133pc{line-height:133% !important;}.pc-w620-padding-32-35-32-35{padding:32px 35px !important;}.pc-w620-padding-10-35-10-35{padding:10px 35px !important;}.pc-w620-padding-35-35-35-35{padding:35px !important;}}@media (max-width:520px){.pc-w520-padding-27-30-27-30{padding:27px 30px !important;}.pc-w520-padding-10-30-10-30{padding:10px 30px !important;}.pc-w520-padding-30-30-30-30{padding:30px !important;}}</style><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;src:url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf8.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf6.woff2') format('woff2');}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjN.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjL.woff2') format('woff2');}</style><!--<![endif]--><!--[if mso]><style type="text/css">.pc-font-alt{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body class="body pc-font-alt" style="width:100% !important;min-height:100% !important;margin:0 !important;padding:0 !important;mso-line-height-rule:exactly;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-variant-ligatures:normal;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;background-color:#f4f4f4" bgcolor="#f4f4f4"><table class="pc-project-body" style="table-layout:fixed;width:100%;min-width:600px;background-color:#f4f4f4" bgcolor="#f4f4f4" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" valign="top" style="width:auto"><table class="pc-project-container" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 0" align="left" valign="top"><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-27-30-27-30 pc-w620-padding-32-35-32-35" style="padding:37px 40px;height:unset;background-color:#1B1B1B" bgcolor="#1B1B1B"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div class="pc-w620-font-size-30px pc-w620-line-height-133pc" style="font-size:36px;line-height:128%;text-align:left;text-align-last:left;color:#fff;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.6px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:36px;line-height:128%;font-weight:800" class="pc-w620-font-size-30px pc-w620-line-height-133pc">Your Equipment is ready for collection...</span></div></div></div></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-10-30-10-30 pc-w620-padding-10-35-10-35" style="padding:10px 40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left"><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Hi, ${escapeHtml(customerName)}</span></div><div><br></div><div><br></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">This email is to confirm that your ${escapeHtml(equipmentMakeModel)} is now ready to collect during business hours.</span></div><div><br></div><div><br></div></div></div></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-30-30-30-30 pc-w620-padding-35-35-35-35" style="padding:40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="top"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" align="left"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left;color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Kind Regards,</span></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyName)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyAddress)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyEmail)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyPhone)}</span></div>${companyWebsite ? `<div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyWebsite)}</span></div>` : ''}<div><br></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">THIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.</span></div></div></div></td></tr></table></td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>`;
}

function generateJobReadyForCollectionText(job: any, customer: any, business?: any): string {
  // Get company details from business settings, with fallbacks
  const companyName = business?.name || 'Moore Horticulture Equipment';
  const companyEmail = business?.email || 'info@mooresmowers.co.uk';
  const companyPhone = business?.phone || '02897510804';
  const companyAddress = business?.address || '9 Drumalig Road, BT27 6UD';
  const companyWebsite = business?.website || '';
  
  // Get equipment make and model
  const equipmentMake = job.equipmentMake || '';
  const equipmentModel = job.equipmentModel || '';
  const equipmentMakeModel = [equipmentMake, equipmentModel].filter(Boolean).join(' ').trim() || job.equipmentDescription || 'equipment';
  
  // Get customer name
  const customerName = customer.name || 'Valued Customer';
  
  return `
${companyName.toUpperCase()}
EQUIPMENT READY FOR COLLECTION

Dear ${customerName},

This email is to confirm that your ${equipmentMakeModel} is now ready to collect during business hours.

Kind Regards,
${companyName}
${companyAddress}
${companyEmail}
${companyPhone}
${companyWebsite ? `${companyWebsite}\n` : ''}

THIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.
  `.trim();
}

// Standalone exported functions for backward compatibility
export async function sendWelcomeEmail(
  email: string,
  fullName: string,
  username: string,
  business: { name: string; emailFromAddress?: string | null }
): Promise<void> {
  const emailService = new EmailService();
  const fromAddress = business.emailFromAddress || emailService.getFromAddress();
  
  const subject = `Welcome to BoltDown - Time to Get Started`;
  const html = `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]--><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="format-detection" content="telephone=no, date=no, address=no, email=no" /><meta name="x-apple-disable-message-reformatting" /><link href="https://fonts.googleapis.com/css?family=Fira+Sans:ital,wght@0,300;0,400;0,500;0,700" rel="stylesheet" /><title>Welcome to BoltDown</title><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;font-display:swap;src:local('Fira Sans Light'),local('FiraSans-Light'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnPKreSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;font-display:swap;src:local('Fira Sans Light'),local('FiraSans-Light'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnPKreQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;font-display:swap;src:local('Fira Sans Light'),local('FiraSans-Light'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnPKreSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;font-display:swap;src:local('Fira Sans Light'),local('FiraSans-Light'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnPKreRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:local('Fira Sans Medium'),local('FiraSans-Medium'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnZKveSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:local('Fira Sans Medium'),local('FiraSans-Medium'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnZKveQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:local('Fira Sans Medium'),local('FiraSans-Medium'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnZKveSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:local('Fira Sans Medium'),local('FiraSans-Medium'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnZKveRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:700;src:local('Fira Sans Bold'),local('FiraSans-Bold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnLK3eSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:700;src:local('Fira Sans Bold'),local('FiraSans-Bold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnLK3eQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:700;src:local('Fira Sans Bold'),local('FiraSans-Bold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnLK3eSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:700;src:local('Fira Sans Bold'),local('FiraSans-Bold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnLK3eRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}</style><!--<![endif]--><style>html,body{margin:0 !important;padding:0 !important;min-height:100% !important;width:100% !important;-webkit-font-smoothing:antialiased;}*{-ms-text-size-adjust:100%;}#outlook a{padding:0;}.ReadMsgBody,.ExternalClass{width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass td,.ExternalClass div,.ExternalClass span,.ExternalClass font{line-height:100%;}table,td,th{mso-table-lspace:0 !important;mso-table-rspace:0 !important;border-collapse:collapse;}u + .body table,u + .body td,u + .body th{will-change:transform;}body,td,th,p,div,li,a,span{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;mso-line-height-rule:exactly;}img{border:0;outline:0;line-height:100%;text-decoration:none;-ms-interpolation-mode:bicubic;}a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}.body .pc-project-body{background-color:transparent !important;}@media (min-width:621px){.pc-lg-hide{display:none;}.pc-lg-bg-img-hide{background-image:none !important;}}</style><style>@media (max-width:620px){.pc-project-body{min-width:0 !important;}.pc-project-container,.pc-component{width:100% !important;}.pc-sm-bg-img-hide{background-image:none !important;}.pc-w620-itemsVSpacings-20{padding-top:10px !important;padding-bottom:10px !important;}.pc-w620-itemsHSpacings-0{padding-left:0 !important;padding-right:0 !important;}table.pc-w620-spacing-0-0-20-0{margin:0 0 20px !important;}td.pc-w620-spacing-0-0-20-0,th.pc-w620-spacing-0-0-20-0{margin:0 !important;padding:0 0 20px !important;}.pc-w620-font-size-16px{font-size:16px !important;}.pc-w620-line-height-163pc{line-height:163% !important;}.pc-w620-padding-35-35-35-35{padding:35px !important;}.pc-w620-padding-30-30-30-30{padding:30px !important;}.pc-g-ib{display:inline-block !important;}.pc-g-b{display:block !important;}.pc-g-rb{display:block !important;width:auto !important;}.pc-g-wf{width:100% !important;}.pc-g-rpt{padding-top:0 !important;}.pc-g-rpr{padding-right:0 !important;}.pc-g-rpb{padding-bottom:0 !important;}.pc-g-rpl{padding-left:0 !important;}.pc-sm-hide{display:none !important;}}@media (max-width:520px){.pc-w520-padding-30-30-30-30{padding:30px !important;}.pc-w520-padding-25-25-25-25{padding:25px !important;}}</style><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;src:url('https://fonts.gstatic.com/l/font?kit=va9B4kDNxMZdWfMOD5VnPKreSBf8&skey=29796a61fd9662f4&v=v18') format('woff'),url('https://fonts.gstatic.com/s/firasans/v18/va9B4kDNxMZdWfMOD5VnPKreSBf6.woff2') format('woff2');}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:url('https://fonts.gstatic.com/l/font?kit=va9E4kDNxMZdWfMOD5VvmYjN&skey=6bde03e5f15b0572&v=v18') format('woff'),url('https://fonts.gstatic.com/s/firasans/v18/va9E4kDNxMZdWfMOD5VvmYjL.woff2') format('woff2');}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:url('https://fonts.gstatic.com/l/font?kit=va9B4kDNxMZdWfMOD5VnZKveSBf8&skey=456b47052756ee1b&v=v18') format('woff'),url('https://fonts.gstatic.com/s/firasans/v18/va9B4kDNxMZdWfMOD5VnZKveSBf6.woff2') format('woff2');}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:700;src:url('https://fonts.gstatic.com/l/font?kit=va9B4kDNxMZdWfMOD5VnLK3eSBf8&skey=dba2db2fadc4e190&v=v18') format('woff'),url('https://fonts.gstatic.com/s/firasans/v18/va9B4kDNxMZdWfMOD5VnLK3eSBf6.woff2') format('woff2');}</style><!--<![endif]--><!--[if mso]><style type="text/css">.pc-font-alt{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body class="body pc-font-alt" style="width:100% !important;min-height:100% !important;margin:0 !important;padding:0 !important;mso-line-height-rule:exactly;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-variant-ligatures:normal;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;background-color:#f4f4f4;font-feature-settings:'calt'" bgcolor="#f4f4f4"><table class="pc-project-body" style="table-layout:fixed;width:100%;min-width:600px;background-color:#f4f4f4" bgcolor="#f4f4f4" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" valign="top" style="width:auto"><table class="pc-project-container" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 0" align="left" valign="top"><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-30-30-30-30 pc-w620-padding-35-35-35-35" style="padding:40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" style="padding:0 0 70px"><table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="width:unset" valign="top"><table class="pc-width-hug pc-g-b" align="left" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody class="pc-g-b"><tr class="pc-g-b"><td class="pc-g-rb pc-g-rpt pc-g-rpb pc-w620-itemsVSpacings-20" valign="middle" style="padding-top:0;padding-bottom:0"><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="middle"><img src="https://cloudfilesdm.com/postcards/Bolt_Down__5___2-24532627.png" style="display:block;outline:0;line-height:100%;-ms-interpolation-mode:bicubic;width:125px;height:auto;max-width:100%;border:0" width="125" height="59" alt="" /></td></tr></table></td></tr></tbody></table></td></tr></table></td></tr></table><table class="pc-width-fill pc-g-b" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody class="pc-g-b"><tr class="pc-g-b pc-g-wf"><td class="pc-g-rb pc-g-rpt pc-g-wf" align="left" valign="middle" style="padding-top:0;padding-bottom:0"><table style="width:334px" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="bottom"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="top"><table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td valign="top" style="padding:0 0 10px;height:auto"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:24px;line-height:142%;text-align:left;text-align-last:left;color:#1b1b1b;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.4px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:24px;line-height:142%;font-weight:700">Welcome! Time to get started.</span></div></div></div></td></tr></table></td></tr></table></td></tr><tr><td align="left" valign="top"><table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="pc-w620-spacing-0-0-20-0" valign="top" style="padding:0 0 40px;height:auto"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div class="pc-w620-font-size-16px pc-w620-line-height-163pc" style="font-size:18px;line-height:156%;text-align:left;text-align-last:left;color:#9b9b9b;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:18px;line-height:156%;font-weight:300" class="pc-w620-font-size-16px pc-w620-line-height-163pc">You're all set up, click the link to log into BoltDown using your login details that will shortly be shared with you via email. </span></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:18px;line-height:156%;font-weight:700">Please Note:</span><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:18px;line-height:156%;font-weight:300"> Along the top menu bar, you will see 'Admin' , please then navigate to 'Users' where you can register your staff as users in your workspace. If you do not have emails for your staff please contact support and we can set up these users&nbsp;&nbsp;for you on your behalf. We recommend using desktop.</span></div></div></div></td></tr></table></td></tr></table></td></tr><tr><td align="left" valign="top"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="min-width:100%"><tr><th valign="top" align="left" style="text-align:left;font-weight:normal"><!--[if mso]><table border="0" cellpadding="0" cellspacing="0" role="presentation" align="left" style="border-collapse:separate;border-spacing:0"><tr><td valign="middle" align="center" style="border-radius:8px;background-color:#417cd6;text-align:center;color:#fff;padding:14px 19px;mso-padding-left-alt:0;margin-left:19px" bgcolor="#417cd6"><a class="pc-font-alt" style="display:inline-block;text-decoration:none;text-align:center" href="https://app.boltdown.co.uk" target="_blank"><span style="font-size:16px;line-height:150%;color:#fff;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal;display:inline-block;vertical-align:top"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;display:inline-block"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:150%;font-weight:500">Get Started</span></span></span></a></td></tr></table><![endif]--><!--[if !mso]><!-- --><a style="display:inline-block;box-sizing:border-box;border-radius:8px;background-color:#417cd6;padding:14px 19px;vertical-align:top;text-align:center;text-align-last:center;text-decoration:none;-webkit-text-size-adjust:none" href="https://app.boltdown.co.uk" target="_blank"><span style="font-size:16px;line-height:150%;color:#fff;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal;display:inline-block;vertical-align:top"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;display:inline-block"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:150%;font-weight:500">Get Started</span></span></span></a><!--<![endif]--></th></tr></table></td></tr></table></td></tr></table></td><td class="pc-g-rb pc-g-rpb pc-g-wf" align="left" valign="middle" style="padding-top:0;padding-bottom:0"><table style="width:186px" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="bottom"><img src="https://cloudfilesdm.com/postcards/Untitled_7-08d9c342.jpg" style="display:block;outline:0;line-height:100%;-ms-interpolation-mode:bicubic;width:186px;height:auto;max-width:100%;border:0" width="186" height="369" alt="" /></td></tr></table></td></tr></tbody></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-25-25-25-25 pc-w620-padding-30-30-30-30" style="padding:36px 40px;height:unset;background-color:#1b1b1b" bgcolor="#1b1b1b"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" valign="top" style="padding:0 0 21px;height:auto"><img src="https://cloudfilesdm.com/postcards/Bolt_Down__4-bafd77e5.png" style="display:block;outline:0;line-height:100%;-ms-interpolation-mode:bicubic;width:125px;height:auto;max-width:100%;border:0" width="125" height="125" alt="" /></td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>`;
  
  const text = `Welcome to BoltDown - Time to Get Started!

You're all set up, click the link to log into BoltDown using your login details that will shortly be shared with you via email.

Please Note: Along the top menu bar, you will see 'Admin', please then navigate to 'Users' where you can register your staff as users in your workspace. If you do not have emails for your staff please contact support and we can set up these users for you on your behalf. We recommend using desktop.

Get Started: https://app.boltdown.co.uk`;
  
  await emailService.sendGenericEmail({
    from: fromAddress,
    to: email,
    subject,
    text,
    html,
  });
}

export async function sendOrderPlacedEmail(
  order: { orderNumber: string; customerName: string; customerEmail: string | null; orderDate: string; status: string; expectedDeliveryDate?: string | null; businessId?: number; customerId?: number | null },
  orderItems: Array<{ itemName: string; quantity: number; itemType: string }>
): Promise<void> {
  if (!order.customerEmail) {
    console.warn(`Cannot send order placed email - no customer email for order ${order.orderNumber}`);
    return;
  }

  const emailService = new EmailService();
  const fromAddress = emailService.getFromAddress();
  
  // Get business information
  let business: any = null;
  if (order.businessId) {
    try {
      business = await storage.getBusiness(order.businessId);
    } catch (error) {
      console.warn(`Failed to fetch business info for order ${order.orderNumber}:`, error);
    }
  }

  // Get company details from business settings, with fallbacks
  const companyName = business?.name || 'Moore Horticulture Equipment';
  const companyEmail = business?.email || 'info@mooresmowers.co.uk';
  const companyPhone = business?.phone || '02897510804';
  const companyAddress = business?.address || '9 Drumalig Road, BT27 6UD';
  const companyWebsite = business?.website || '';

  // Get customer name
  const customerName = order.customerName || 'Valued Customer';

  // Format item names - join with commas or list them
  const itemNames = orderItems.map(item => item.itemName).join(', ');

  // Escape HTML to prevent XSS
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return '';
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };

  const subject = `Order Confirmation - ${order.orderNumber}`;
  const html = `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]--><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="format-detection" content="telephone=no, date=no, address=no, email=no" /><meta name="x-apple-disable-message-reformatting" /><link href="https://fonts.googleapis.com/css?family=Fira+Sans:ital,wght@0,400;0,800" rel="stylesheet" /><title>Order Confirmation - ${escapeHtml(order.orderNumber)}</title><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmojLazX3dGTP.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvk4jLazX3dGTP.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmYjLazX3dGTP.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvl4jLazX3dA.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}</style><!--<![endif]--><style>html,body{margin:0 !important;padding:0 !important;min-height:100% !important;width:100% !important;-webkit-font-smoothing:antialiased;}*{-ms-text-size-adjust:100%;}#outlook a{padding:0;}.ReadMsgBody,.ExternalClass{width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass td,.ExternalClass div,.ExternalClass span,.ExternalClass font{line-height:100%;}table,td,th{mso-table-lspace:0 !important;mso-table-rspace:0 !important;border-collapse:collapse;}u + .body table,u + .body td,u + .body th{will-change:transform;}body,td,th,p,div,li,a,span{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;mso-line-height-rule:exactly;}img{border:0;outline:0;line-height:100%;text-decoration:none;-ms-interpolation-mode:bicubic;}a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}.body .pc-project-body{background-color:transparent !important;}@media (min-width:621px){.pc-lg-hide{display:none;}.pc-lg-bg-img-hide{background-image:none !important;}}</style><style>@media (max-width:620px){.pc-project-body{min-width:0 !important;}.pc-project-container,.pc-component{width:100% !important;}.pc-sm-hide{display:none !important;}.pc-sm-bg-img-hide{background-image:none !important;}.pc-w620-font-size-30px{font-size:30px !important;}.pc-w620-line-height-133pc{line-height:133% !important;}.pc-w620-padding-32-35-32-35{padding:32px 35px !important;}.pc-w620-padding-10-35-10-35{padding:10px 35px !important;}.pc-w620-padding-35-35-35-35{padding:35px !important;}}@media (max-width:520px){.pc-w520-padding-27-30-27-30{padding:27px 30px !important;}.pc-w520-padding-10-30-10-30{padding:10px 30px !important;}.pc-w520-padding-30-30-30-30{padding:30px !important;}}</style><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;src:url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf8.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf6.woff2') format('woff2');}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjN.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjL.woff2') format('woff2');}</style><!--<![endif]--><!--[if mso]><style type="text/css">.pc-font-alt{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body class="body pc-font-alt" style="width:100% !important;min-height:100% !important;margin:0 !important;padding:0 !important;mso-line-height-rule:exactly;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-variant-ligatures:normal;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;background-color:#f4f4f4" bgcolor="#f4f4f4"><table class="pc-project-body" style="table-layout:fixed;width:100%;min-width:600px;background-color:#f4f4f4" bgcolor="#f4f4f4" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" valign="top" style="width:auto"><table class="pc-project-container" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 0" align="left" valign="top"><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-27-30-27-30 pc-w620-padding-32-35-32-35" style="padding:37px 40px;height:unset;background-color:#1B1B1B" bgcolor="#1B1B1B"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div class="pc-w620-font-size-30px pc-w620-line-height-133pc" style="font-size:36px;line-height:128%;text-align:left;text-align-last:left;color:#fff;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.6px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:36px;line-height:128%;font-weight:800" class="pc-w620-font-size-30px pc-w620-line-height-133pc">Your Order has been confirmed...</span></div></div></div></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-10-30-10-30 pc-w620-padding-10-35-10-35" style="padding:10px 40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left"><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Hi, ${escapeHtml(customerName)}</span></div><div><br></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">This email is to confirm that your order for ${escapeHtml(itemNames)} with order ID ${escapeHtml(order.orderNumber)} has been confirmed.</span></div><div><br></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">We would like to thank you for your business, and ask that you monitor your emails as we will let you know when the above item arrives in stock and is ready for collection.</span></div></div></div></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-30-30-30-30 pc-w620-padding-35-35-35-35" style="padding:40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="top"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" align="left"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left;color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Kind Regards,</span></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyName)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyAddress)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyEmail)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyPhone)}</span></div>${companyWebsite ? `<div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyWebsite)}</span></div>` : ''}<div><br></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">THIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.</span></div></div></div></td></tr></table></td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>`;
  
  const text = `Order Confirmation - ${order.orderNumber}\n\nHi, ${customerName}\n\nThis email is to confirm that your order for ${itemNames} with order ID ${order.orderNumber} has been confirmed.\n\nWe would like to thank you for your business, and ask that you monitor your emails as we will let you know when the above item arrives in stock and is ready for collection.\n\nKind Regards,\n${companyName}\n${companyAddress}\n${companyEmail}\n${companyPhone}${companyWebsite ? `\n${companyWebsite}` : ''}\n\nTHIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.`;
  
  await emailService.sendGenericEmail({
    from: fromAddress,
    to: order.customerEmail,
    subject,
    text,
    html,
  });

  // Log to email history
  if (order.businessId) {
    await logEmailToHistory({
      businessId: order.businessId,
      customerEmail: order.customerEmail,
      subject,
      body: text,
      emailType: 'order_placed',
      customerId: order.customerId ?? null,
      metadata: { orderNumber: order.orderNumber },
    });
  }
}

export async function sendOrderArrivedEmail(
  order: { orderNumber: string; customerName: string; customerEmail: string | null; actualDeliveryDate?: string | null; businessId?: number; customerId?: number | null },
  orderItems: Array<{ itemName: string; quantity: number; itemType: string }>
): Promise<void> {
  if (!order.customerEmail) {
    console.warn(`Cannot send order arrived email - no customer email for order ${order.orderNumber}`);
    return;
  }

  const emailService = new EmailService();
  const fromAddress = emailService.getFromAddress();
  
  // Get business information
  let business: any = null;
  if (order.businessId) {
    try {
      business = await storage.getBusiness(order.businessId);
    } catch (error) {
      console.warn(`Failed to fetch business info for order ${order.orderNumber}:`, error);
    }
  }

  // Get company details from business settings, with fallbacks
  const companyName = business?.name || 'Moore Horticulture Equipment';
  const companyEmail = business?.email || 'info@mooresmowers.co.uk';
  const companyPhone = business?.phone || '02897510804';
  const companyAddress = business?.address || '9 Drumalig Road, BT27 6UD';
  const companyWebsite = business?.website || '';

  // Get customer name
  const customerName = order.customerName || 'Valued Customer';

  // Format item names - join with commas
  const itemNames = orderItems.map(item => item.itemName).join(', ');

  // Escape HTML to prevent XSS
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return '';
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };

  const subject = `Your Order has Arrived! - ${order.orderNumber}`;
  const html = `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]--><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="format-detection" content="telephone=no, date=no, address=no, email=no" /><meta name="x-apple-disable-message-reformatting" /><link href="https://fonts.googleapis.com/css?family=Fira+Sans:ital,wght@0,400;0,800" rel="stylesheet" /><title>Your Order has Arrived!</title><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmojLazX3dGTP.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvk4jLazX3dGTP.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5VvmYjLazX3dGTP.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:local('Fira Sans Regular'),local('FiraSans-Regular'),url(https://fonts.gstatic.com/s/firasans/v10/va9E4kDNxMZdWfMOD5Vvl4jLazX3dA.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}</style><!--<![endif]--><style>html,body{margin:0 !important;padding:0 !important;min-height:100% !important;width:100% !important;-webkit-font-smoothing:antialiased;}*{-ms-text-size-adjust:100%;}#outlook a{padding:0;}.ReadMsgBody,.ExternalClass{width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass td,.ExternalClass div,.ExternalClass span,.ExternalClass font{line-height:100%;}table,td,th{mso-table-lspace:0 !important;mso-table-rspace:0 !important;border-collapse:collapse;}u + .body table,u + .body td,u + .body th{will-change:transform;}body,td,th,p,div,li,a,span{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;mso-line-height-rule:exactly;}img{border:0;outline:0;line-height:100%;text-decoration:none;-ms-interpolation-mode:bicubic;}a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}.body .pc-project-body{background-color:transparent !important;}@media (min-width:621px){.pc-lg-hide{display:none;}.pc-lg-bg-img-hide{background-image:none !important;}}</style><style>@media (max-width:620px){.pc-project-body{min-width:0 !important;}.pc-project-container,.pc-component{width:100% !important;}.pc-sm-hide{display:none !important;}.pc-sm-bg-img-hide{background-image:none !important;}.pc-w620-font-size-30px{font-size:30px !important;}.pc-w620-line-height-133pc{line-height:133% !important;}.pc-w620-padding-32-35-32-35{padding:32px 35px !important;}.pc-w620-padding-10-35-10-35{padding:10px 35px !important;}.pc-w620-padding-35-35-35-35{padding:35px !important;}}@media (max-width:520px){.pc-w520-padding-27-30-27-30{padding:27px 30px !important;}.pc-w520-padding-10-30-10-30{padding:10px 30px !important;}.pc-w520-padding-30-30-30-30{padding:30px !important;}}</style><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;src:url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf8.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9B4kDNxMZdWfMOD5VnMK7eSBf6.woff2') format('woff2');}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:400;src:url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjN.woff') format('woff'),url('https://fonts.gstatic.com/s/firasans/v17/va9E4kDNxMZdWfMOD5VvmYjL.woff2') format('woff2');}</style><!--<![endif]--><!--[if mso]><style type="text/css">.pc-font-alt{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body class="body pc-font-alt" style="width:100% !important;min-height:100% !important;margin:0 !important;padding:0 !important;mso-line-height-rule:exactly;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-variant-ligatures:normal;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;background-color:#f4f4f4" bgcolor="#f4f4f4"><table class="pc-project-body" style="table-layout:fixed;width:100%;min-width:600px;background-color:#f4f4f4" bgcolor="#f4f4f4" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" valign="top" style="width:auto"><table class="pc-project-container" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 0" align="left" valign="top"><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-27-30-27-30 pc-w620-padding-32-35-32-35" style="padding:37px 40px;height:unset;background-color:#1B1B1B" bgcolor="#1B1B1B"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div class="pc-w620-font-size-30px pc-w620-line-height-133pc" style="font-size:36px;line-height:128%;text-align:left;text-align-last:left;color:#fff;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.6px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:36px;line-height:128%;font-weight:800" class="pc-w620-font-size-30px pc-w620-line-height-133pc">Your Order has Arrived!</span></div></div></div></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-10-30-10-30 pc-w620-padding-10-35-10-35" style="padding:10px 40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left"><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Hi, ${escapeHtml(customerName)}</span></div><div><br></div><div><br></div><div style="color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">This email is to confirm that your order for ${escapeHtml(itemNames)} with order ID ${escapeHtml(order.orderNumber)} has now arrived and is ready for collection. Please visit us to collect at any time during business hours.</span></div></div></div></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-30-30-30-30 pc-w620-padding-35-35-35-35" style="padding:40px;height:unset;background-color:#fff" bgcolor="#ffffff"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="top"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" align="left"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:15px;line-height:140%;text-align:left;text-align-last:left;color:#333;font-family:'Fira Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">Kind Regards,</span></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyName)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyAddress)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyEmail)}</span></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyPhone)}</span></div>${companyWebsite ? `<div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">${escapeHtml(companyWebsite)}</span></div>` : ''}<div><br></div><div><br></div><div style="font-family:'Fira Sans',Arial,Helvetica,sans-serif"><span style="font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:140%;font-weight:400">THIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.</span></div></div></div></td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>`;
  
  const text = `Your Order has Arrived! - ${order.orderNumber}\n\nHi, ${customerName}\n\nThis email is to confirm that your order for ${itemNames} with order ID ${order.orderNumber} has now arrived and is ready for collection. Please visit us to collect at any time during business hours.\n\nKind Regards,\n${companyName}\n${companyAddress}\n${companyEmail}\n${companyPhone}${companyWebsite ? `\n${companyWebsite}` : ''}\n\nTHIS EMAIL HAS BEEN SENT BY BOLTDOWN, A WORKSHOP MANAGEMENT SYSTEM. THIS MAILBOX IS NOT MONITORED - DO NOT REPLY TO THIS EMAIL.`;
  
  await emailService.sendGenericEmail({
    from: fromAddress,
    to: order.customerEmail,
    subject,
    text,
    html,
  });

  // Log to email history
  if (order.businessId) {
    await logEmailToHistory({
      businessId: order.businessId,
      customerEmail: order.customerEmail,
      subject,
      body: text,
      emailType: 'order_arrived',
      customerId: order.customerId ?? null,
      metadata: { orderNumber: order.orderNumber },
    });
  }
}