import nodemailer = require('nodemailer');
import { Resend } from "resend";
import { storage } from '../storage';
import { format } from 'date-fns';

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

interface CallbackEmailData {
  id: number;
  customerName: string;
  phone: string;
  reason: string;
  requestedAt: string;
  priority: string;
  status: string;
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

    const fromAddress = `support@boltdown.co.uk`;

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

  async sendWeeklyCallbackReport(businessId?: number): Promise<boolean> {
    try {
      // If businessId is provided, get callbacks for that business only
      // Otherwise, this would need to be called per business or iterate through all businesses
      // For now, we'll require businessId
      if (!businessId) {
        console.error("Business ID is required for weekly callback report");
        return false;
      }
      
      // Get all pending callbacks for the business
      const callbacks = await storage.getAllCallbackRequests(businessId);
      const pendingCallbacks = callbacks.filter((callback: any) => callback.status === 'pending');

      if (pendingCallbacks.length === 0) {
        console.log('No pending callbacks to report');
        return true;
      }

      const emailContent = this.generateCallbackReportHTML(pendingCallbacks);
      const textContent = this.generateCallbackReportText(pendingCallbacks);

      const subject = `Weekly Callback Report - ${pendingCallbacks.length} Pending Callbacks`;

      // Prefer Resend if configured
      if (process.env.RESEND_API_KEY) {
        await this.sendEmailWithResend({
          from: 'support@boltdown.co.uk',
          to: 'support@boltdown.co.uk',
          subject,
          text: textContent,
          html: emailContent,
        });
        console.log(`✅ Weekly callback report email sent successfully via Resend`);
        return true;
      }

      // Fallback to MailerSend if configured
      if (process.env.MAILERSEND_API_KEY) {
        await this.sendEmailWithMailerSend({
          from: 'support@boltdown.co.uk',
          to: 'support@boltdown.co.uk',
          subject,
          text: textContent,
          html: emailContent,
        });
        console.log(`✅ Weekly callback report email sent successfully via MailerSend`);
        return true;
      }

      // Demo mode: Show email content instead of sending
      console.log('\n📧 === WEEKLY CALLBACK EMAIL REPORT (DEMO MODE) ===');
      console.log(`To: support@boltdown.co.uk`);
      console.log(`From: support@boltdown.co.uk`);
      console.log(`Subject: ${subject}`);
      console.log('\n--- EMAIL CONTENT (TEXT VERSION) ---');
      console.log(textContent);
      console.log('\n--- EMAIL CONTENT (HTML VERSION) ---');
      console.log('✅ Professional HTML email generated with:');
      console.log(`   • Company branding and responsive design`);
      console.log(`   • ${pendingCallbacks.length} callback details with priorities`);
      console.log(`   • Customer contact information`);
      console.log(`   • Email size: ${emailContent.length} characters`);
      console.log('=== END EMAIL REPORT ===\n');

      console.log(`✅ Weekly callback report generated successfully (demo mode) - ${pendingCallbacks.length} pending callbacks`);
      return true;
    } catch (error) {
      console.error('Error generating weekly callback report:', error);
      return false;
    }
  }

  private generateCallbackReportHTML(callbacks: any[]): string {
    const currentDate = format(new Date(), 'EEEE, MMMM do, yyyy');
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Callback Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }
        .email-wrapper {
            max-width: 700px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            color: white;
            padding: 50px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 8s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }
        .header-content {
            position: relative;
            z-index: 1;
        }
        .header-icon {
            font-size: 64px;
            margin-bottom: 16px;
            display: inline-block;
            animation: bounce 2s ease-in-out infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .header h1 {
            margin: 0 0 12px 0;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: -0.5px;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        .header p {
            margin: 8px 0 0 0;
            font-size: 16px;
            opacity: 0.95;
            font-weight: 400;
        }
        .summary-card {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 40px;
            margin: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }
        .summary-card::after {
            content: '';
            position: absolute;
            top: -50px;
            right: -50px;
            width: 200px;
            height: 200px;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            border-radius: 50%;
        }
        .summary-content {
            position: relative;
            z-index: 1;
        }
        .summary-number {
            font-size: 72px;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 16px;
            line-height: 1;
        }
        .summary-title {
            font-size: 24px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 12px;
        }
        .summary-text {
            font-size: 16px;
            color: #4a5568;
            line-height: 1.7;
        }
        .callbacks-container {
            padding: 0 40px 40px 40px;
        }
        .callback-item {
            background: #ffffff;
            border: 2px solid #e2e8f0;
            border-radius: 20px;
            padding: 32px;
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .callback-item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 6px;
            background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
        }
        .callback-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(102, 126, 234, 0.2);
            border-color: #667eea;
        }
        .callback-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }
        .customer-name {
            font-size: 24px;
            font-weight: 700;
            color: #1a202c;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .customer-name::before {
            content: '👤';
            font-size: 28px;
        }
        .priority {
            padding: 10px 20px;
            border-radius: 50px;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .priority::before {
            content: '●';
            font-size: 10px;
        }
        .priority.high {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            color: white;
        }
        .priority.medium {
            background: linear-gradient(135deg, #ffd93d 0%, #f6c23e 100%);
            color: #1a202c;
        }
        .priority.low {
            background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
            color: white;
        }
        .callback-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .detail-item {
            display: flex;
            flex-direction: column;
            padding: 16px;
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }
        .detail-label {
            font-size: 11px;
            font-weight: 700;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        .detail-value {
            font-size: 16px;
            color: #2d3748;
            font-weight: 600;
        }
        .reason {
            background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
            padding: 20px;
            border-radius: 16px;
            border-left: 4px solid #fc8181;
            margin-top: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        .reason-label {
            font-size: 12px;
            font-weight: 700;
            color: #c53030;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .reason-label::before {
            content: '📝';
            font-size: 16px;
        }
        .reason-text {
            font-size: 15px;
            color: #2d3748;
            line-height: 1.7;
        }
        .footer {
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            color: #cbd5e0;
            text-align: center;
            padding: 40px;
        }
        .footer p {
            margin: 8px 0;
            font-size: 14px;
            line-height: 1.6;
        }
        .footer-strong {
            color: #ffffff;
            font-weight: 600;
        }
        @media (max-width: 600px) {
            body { padding: 20px 10px; }
            .email-wrapper { border-radius: 16px; }
            .header { padding: 40px 24px; }
            .header h1 { font-size: 28px; }
            .summary-card { margin: 24px; padding: 32px 24px; }
            .summary-number { font-size: 56px; }
            .callbacks-container { padding: 0 24px 24px 24px; }
            .callback-item { padding: 24px; }
            .callback-header { flex-direction: column; }
            .callback-details { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <div class="header-content">
                <div class="header-icon">🔔</div>
                <h1>Weekly Callback Report</h1>
                <p>Moore Horticulture Equipment Management System</p>
                <p style="margin-top: 8px; font-size: 14px; opacity: 0.9;">${currentDate}</p>
            </div>
        </div>

        <div class="summary-card">
            <div class="summary-content">
                <div class="summary-number">${callbacks.length}</div>
                <div class="summary-title">Pending Callbacks</div>
                <div class="summary-text">
                    ${callbacks.length === 1 ? 'customer callback' : 'customer callbacks'} require your attention this week. 
                    Each callback represents a customer waiting for contact regarding their equipment service.
                </div>
            </div>
        </div>

        <div class="callbacks-container">
            ${callbacks.map((callback, index) => `
            <div class="callback-item">
                <div class="callback-header">
                    <h3 class="customer-name">${callback.customerName}</h3>
                    <span class="priority ${callback.priority.toLowerCase()}">${callback.priority} Priority</span>
                </div>
                
                <div class="callback-details">
                    <div class="detail-item">
                        <span class="detail-label">📞 Phone Number</span>
                        <span class="detail-value">${callback.phoneNumber || 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">📅 Requested Date</span>
                        <span class="detail-value">${format(new Date(callback.requestedAt), 'MMM do, yyyy \'at\' h:mm a')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">⚡ Status</span>
                        <span class="detail-value">${callback.status}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">🔢 Callback #</span>
                        <span class="detail-value">#${callback.id}</span>
                    </div>
                </div>

                ${callback.details ? `
                <div class="reason">
                    <div class="reason-label">Details</div>
                    <div class="reason-text">${callback.details}</div>
                </div>
                ` : ''}
                
                ${callback.subject ? `
                <div class="reason">
                    <div class="reason-label">Subject</div>
                    <div class="reason-text">${callback.subject}</div>
                </div>
                ` : ''}
            </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>This is an automated weekly report from the <span class="footer-strong">Moore Horticulture Equipment Management System</span>.</p>
            <p>Please log into the system to manage these callbacks and update their status.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateCallbackReportText(callbacks: any[]): string {
    const currentDate = format(new Date(), 'EEEE, MMMM do, yyyy');
    
    let text = `WEEKLY CALLBACK REPORT - ${currentDate}\n`;
    text += `Moore Horticulture Equipment Management System\n\n`;
    text += `SUMMARY\n`;
    text += `${callbacks.length} pending customer callbacks require attention this week.\n\n`;

    callbacks.forEach((callback, index) => {
      text += `CALLBACK #${index + 1} (ID: ${callback.id})\n`;
      text += `Customer: ${callback.customerName}\n`;
      text += `Phone: ${callback.phoneNumber || 'Not provided'}\n`;
      text += `Priority: ${callback.priority}\n`;
      text += `Requested: ${format(new Date(callback.requestedAt), 'MMM do, yyyy \'at\' h:mm a')}\n`;
      text += `Status: ${callback.status}\n`;
      if (callback.subject) {
        text += `Subject: ${callback.subject}\n`;
      }
      if (callback.details) {
        text += `Details: ${callback.details}\n`;
      }
      text += `\n`;
    });

    text += `Please log into the Moore Horticulture Equipment Management System to manage these callbacks.\n`;
    
    return text;
  }

  getFromAddress(): string {
    // Return default from address based on configured provider
    if (process.env.RESEND_API_KEY) {
      return 'support@boltdown.co.uk';
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

// Export individual functions for backward compatibility
const emailService = new EmailService();

export async function sendEmail(apiKey: string, params: any): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendEmail called with:', apiKey, params);
  return false;
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

export async function sendJobBookedEmail(job: any, customer: any): Promise<boolean> {
  try {
    if (!customer.email) {
      console.log('No customer email provided, skipping job receipt email');
      return false;
    }

    const emailContent = generateJobBookedHTML(job, customer);
    const textContent = generateJobBookedText(job, customer);

    const subject = `Job Booked - ${job.jobId}`;

    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithResend({
        from: "support@boltdown.co.uk",
        to: customer.email,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Job booked email sent successfully via Resend to ${customer.name} (${customer.email})`);
      return true;
    }

    // Fallback to MailerSend if configured
    if (process.env.MAILERSEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithMailerSend({
        from: "support@boltdown.co.uk",
        to: customer.email,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Job booked email sent successfully via MailerSend to ${customer.name} (${customer.email})`);
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
    
    return true;
  } catch (error) {
    console.error('Error in sendJobBookedEmail:', error);
    return false;
  }
}

export async function sendJobCompletedEmail(customerEmail: string, jobDetails: any): Promise<boolean> {
  // This function is not implemented yet but exported for compatibility
  console.log('sendJobCompletedEmail called');
  return false;
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

    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithResend({
        from: "support@boltdown.co.uk",
        to: part.customerEmail,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Part ready email sent successfully via Resend to ${part.customerName} (${part.customerEmail})`);
      return true;
    }

    // Fallback to MailerSend if configured
    if (process.env.MAILERSEND_API_KEY) {
      const emailService = new EmailService();
      await emailService.sendEmailWithMailerSend({
        from: "support@boltdown.co.uk",
        to: part.customerEmail,
        subject,
        text: textContent,
        html: emailContent,
      });
      console.log(`✅ Part ready email sent successfully via MailerSend to ${part.customerName} (${part.customerEmail})`);
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

function generateJobBookedHTML(job: any, customer: any): string {
  const currentDate = format(new Date(), 'EEEE, MMMM do, yyyy');
  const createdDate = job.createdAt ? format(new Date(job.createdAt), 'MMMM do, yyyy') : currentDate;
  
  return `
<!DOCTYPE html><!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]--><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="format-detection" content="telephone=no, date=no, address=no, email=no" /><meta name="x-apple-disable-message-reformatting" /><title>Untitled</title><!-- Made with Postcards Email Builder by Designmodo --><!--[if !mso]><!-- --><style>@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;font-display:swap;src:local('Fira Sans Light'),local('FiraSans-Light'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnPKreSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;font-display:swap;src:local('Fira Sans Light'),local('FiraSans-Light'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnPKreQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;font-display:swap;src:local('Fira Sans Light'),local('FiraSans-Light'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnPKreSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:300;font-display:swap;src:local('Fira Sans Light'),local('FiraSans-Light'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnPKreRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:local('Fira Sans Medium'),local('FiraSans-Medium'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnZKveSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:local('Fira Sans Medium'),local('FiraSans-Medium'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnZKveQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:local('Fira Sans Medium'),local('FiraSans-Medium'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnZKveSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:500;src:local('Fira Sans Medium'),local('FiraSans-Medium'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnZKveRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSxf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eQhf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eSBf6Xl7Gl3LX.woff2) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF;}@font-face{font-family:'Fira Sans';font-style:normal;font-weight:800;font-display:swap;src:local('Fira Sans ExtraBold'),local('FiraSans-ExtraBold'),url(https://fonts.gstatic.com/s/firasans/v10/va9B4kDNxMZdWfMOD5VnMK7eRhf6Xl7Glw.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}</style><!--<![endif]--><style>html,body{margin:0 !important;padding:0 !important;min-height:100% !important;width:100% !important;-webkit-font-smoothing:antialiased;}*{-ms-text-size-adjust:100%;}#outlook a{padding:0;}.ReadMsgBody,.ExternalClass{width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass td,.ExternalClass div,.ExternalClass span,.ExternalClass font{line-height:100%;}table,td,th{mso-table-lspace:0 !important;mso-table-rspace:0 !important;border-collapse:collapse;}u + .body table,u + .body td,u + .body th{will-change:transform;}body,td,th,p,div,li,a,span{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;mso-line-height-rule:exactly;}img{border:0;outline:0;line-height:100%;text-decoration:none;-ms-interpolation-mode:bicubic;}a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}.body .pc-project-body{background-color:transparent !important;}@media (min-width:621px){.pc-lg-hide{display:none;}.pc-lg-bg-img-hide{background-image:none !important;}}</style><style>@media (max-width:620px){.pc-project-body{min-width:0 !important;}.pc-project-container,.pc-component{width:100% !important;}.pc-sm-hide{display:none !important;}.pc-sm-bg-img-hide{background-image:none !important;}table.pc-w620-spacing-0-0-40-0{margin:0 0 40px !important;}td.pc-w620-spacing-0-0-40-0,th.pc-w620-spacing-0-0-40-0{margin:0 !important;padding:0 0 40px !important;}.pc-w620-fontSize-30{font-size:30px !important;}.pc-w620-lineHeight-133pc{line-height:133% !important;}.pc-w620-fontSize-16{font-size:16px !important;}.pc-w620-lineHeight-163pc{line-height:163% !important;}.pc-w620-padding-35-35-35-35{padding:35px !important;}}@media (max-width:520px){.pc-w520-padding-30-30-30-30{padding:30px !important;}}</style><!--[if mso]><style type="text/css">.pc-font-alt{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body class="body pc-font-alt" style="width:100% !important;min-height:100% !important;margin:0 !important;padding:0 !important;mso-line-height-rule:exactly;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-variant-ligatures:normal;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;background-color:#f4f4f4" bgcolor="#f4f4f4"><table class="pc-project-body" style="table-layout:fixed;width:100%;min-width:600px;background-color:#f4f4f4" bgcolor="#f4f4f4" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" valign="top" style="width:auto"><table class="pc-project-container" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 0" align="left" valign="top"><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w520-padding-30-30-30-30 pc-w620-padding-35-35-35-35" style="padding:40px;height:unset;background-color:#1B1B1B" bgcolor="#1B1B1B"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="pc-w620-spacing-0-0-40-0" align="center" valign="top" style="padding:0 0 60px;height:auto"><img src="https://cloudfilesdm.com/postcards/logo-white.png" style="display:block;outline:0;line-height:100%;-ms-interpolation-mode:bicubic;width:125px;height:auto;max-width:100%;border:0" width="125" height="25" alt="" /></td></tr></table><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" valign="top" style="padding:0 0 17px;height:auto"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin-right:auto;margin-left:auto"><tr><td valign="top" align="center"><div class="pc-font-alt" style="line-height:121%;letter-spacing:-0.2px;font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:14px;font-weight:500;color:#40be65;text-align:center;text-align-last:center"> Introducing</div></td></tr></table></td></tr></table><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" valign="top" style="padding:0 0 30px;height:auto"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin-right:auto;margin-left:auto"><tr><td valign="top" align="center"><div class="pc-font-alt pc-w620-fontSize-30 pc-w620-lineHeight-133pc" style="line-height:128%;letter-spacing:-0.6px;font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:36px;font-weight:800;color:#fff;text-align:center;text-align-last:center"> Simple post for <br/>Smart blog</div></td></tr></table></td></tr></table><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" valign="top" style="padding:0 0 30px;height:auto"><img src="https://cloudfilesdm.com/postcards/header-2-image-1.jpg" style="display:block;outline:0;line-height:100%;-ms-interpolation-mode:bicubic;width:285px;height:auto;max-width:100%;border:0" width="285" height="285" alt="" /></td></tr></table><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" valign="top" style="padding:0 0 29px;height:auto"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin-right:auto;margin-left:auto"><tr><td valign="top" align="center"><div class="pc-font-alt pc-w620-fontSize-16 pc-w620-lineHeight-163pc" style="line-height:156%;letter-spacing:-0.2px;font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:18px;font-weight:300;color:#fff;text-align:center;text-align-last:center"> Co-ordinate campaigns and product launches, <br/>with improved overall communication.</div></td></tr></table></td></tr></table><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="min-width:100%"><tr><th valign="top" align="center" style="text-align:center;font-weight:normal;line-height:100%"><!--[if mso]><table border="0" cellpadding="0" cellspacing="0" role="presentation" align="center" style="border-collapse:separate;border-spacing:0;margin-right:auto;margin-left:auto"><tr><td valign="middle" align="center" style="border-radius:8px;background-color:#1595e7;text-align:center;color:#fff;padding:15px 17px;mso-padding-left-alt:0;margin-left:17px" bgcolor="#1595e7"><a class="pc-font-alt" style="display:inline-block;text-decoration:none;font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-weight:500;font-size:16px;line-height:150%;letter-spacing:-0.2px;text-align:center;color:#fff" href="https://postcards.email/" target="_blank">Download manual</a></td></tr></table><![endif]--><!--[if !mso]><!-- --><a style="display:inline-block;box-sizing:border-box;border-radius:8px;background-color:#1595e7;padding:15px 17px;font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-weight:500;font-size:16px;line-height:150%;letter-spacing:-0.2px;color:#fff;vertical-align:top;text-align:center;text-align-last:center;text-decoration:none;-webkit-text-size-adjust:none" href="https://postcards.email/" target="_blank">Download manual</a><!--<![endif]--></th></tr></table></td></tr></table><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" valign="top" style="padding-top:20px;padding-bottom:20px;vertical-align:top"><a href="https://postcards.email/?uid=MzM0NzIw&type=footer" target="_blank" style="text-decoration:none;overflow:hidden;border-radius:2px;display:inline-block"><img src="https://cloudfilesdm.com/postcards/promo-footer-dark.jpg" width="198" height="46" alt="Made with (o -) postcards" style="width:198px;height:auto;margin:0 auto;border:0;outline:0;line-height:100%;-ms-interpolation-mode:bicubic;vertical-align:top"></a><img src="https://api-postcards.designmodo.com/tracking/mail/promo?uid=MzM0NzIw" width="1" height="1" alt="" style="display:none;width:1px;height:1px"></td></tr></table></td></tr></table></td></tr></table></body></html>
  `;
}

function generateJobBookedText(job: any, customer: any): string {
  const currentDate = format(new Date(), 'EEEE, MMMM do, yyyy');
  const createdDate = job.createdAt ? format(new Date(job.createdAt), 'MMMM do, yyyy') : currentDate;
  
  return `
MOORE HORTICULTURE EQUIPMENT
Professional Equipment Sales & Service

JOB SUCCESSFULLY BOOKED

Dear ${customer.name},

Thank you for choosing Moore Horticulture Equipment. We have received your service request and your job has been successfully booked into our system.

JOB DETAILS:
- Job ID: ${job.jobId}
- Booking Date: ${createdDate}
- Equipment: ${job.equipmentDescription || 'To be assessed'}
- Status: ${job.status === 'waiting_assessment' ? 'Waiting Assessment' : job.status}
${job.description ? `- Description: ${job.description}\n` : ''}

WHAT HAPPENS NEXT?
Our team will assess your equipment and contact you with:
- Estimated repair time
- Quote for any required work
- Updates on the job progress

IMPORTANT: Please keep your Job ID (${job.jobId}) for reference.

TRACK YOUR JOB ONLINE:
You can track the progress of your job anytime using our online job tracker:
Job ID: ${job.jobId}
Email: ${customer.email}

NEED TO CONTACT US?
If you have any questions or need to provide additional information:
Phone: 01580 212222
Email: info@mooresmowers.co.uk

Thank you for choosing Moore Horticulture Equipment. We look forward to serving you!

Best regards,
The Moore Horticulture Team

---
This email was sent automatically from the Moore Horticulture Equipment Management System on ${currentDate}.
If you believe you received this email in error, please contact us immediately.
  `;
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
  
  const subject = `Welcome to ${business.name}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #22c55e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${business.name}!</h1>
    </div>
    <div class="content">
      <p>Dear ${fullName},</p>
      <p>Your account has been created successfully.</p>
      <p><strong>Username:</strong> ${username}</p>
      <p>You can now log in to access the system.</p>
      <p>Best regards,<br>${business.name}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const text = `Welcome to ${business.name}!\n\nDear ${fullName},\n\nYour account has been created successfully.\n\nUsername: ${username}\n\nYou can now log in to access the system.\n\nBest regards,\n${business.name}`;
  
  await emailService.sendGenericEmail({
    from: fromAddress,
    to: email,
    subject,
    text,
    html,
  });
}

export async function sendOrderPlacedEmail(
  order: { orderNumber: string; customerName: string; customerEmail: string | null; orderDate: string; status: string; expectedDeliveryDate?: string | null },
  orderItems: Array<{ itemName: string; quantity: number; itemType: string }>
): Promise<void> {
  if (!order.customerEmail) {
    console.warn(`Cannot send order placed email - no customer email for order ${order.orderNumber}`);
    return;
  }

  const emailService = new EmailService();
  const fromAddress = emailService.getFromAddress();
  
  const itemsList = orderItems.map(item => 
    `  • ${item.itemName} (${item.quantity}x) - ${item.itemType}`
  ).join('\n');

  const subject = `Order Confirmation - ${order.orderNumber}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #22c55e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .status { display: inline-block; padding: 5px 15px; background: #dbeafe; color: #1e40af; border-radius: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Confirmation</h1>
    </div>
    <div class="content">
      <p>Dear ${order.customerName},</p>
      <p>Thank you for your order! We've received your order and will process it shortly.</p>
      
      <div class="order-info">
        <h3>Order Details</h3>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Order Date:</strong> ${new Date(order.orderDate).toLocaleDateString()}</p>
        <p><strong>Status:</strong> <span class="status">${order.status}</span></p>
        ${order.expectedDeliveryDate ? `<p><strong>Expected Delivery:</strong> ${new Date(order.expectedDeliveryDate).toLocaleDateString()}</p>` : ''}
      </div>

      <div class="order-info">
        <h3>Items Ordered</h3>
        <pre style="font-family: inherit; white-space: pre-wrap;">${itemsList}</pre>
      </div>

      <p>We'll keep you updated on the status of your order. If you have any questions, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>The Team</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const text = `Order Confirmation - ${order.orderNumber}\n\nDear ${order.customerName},\n\nThank you for your order! We've received your order and will process it shortly.\n\nOrder Details:\n- Order Number: ${order.orderNumber}\n- Order Date: ${new Date(order.orderDate).toLocaleDateString()}\n- Status: ${order.status}\n${order.expectedDeliveryDate ? `- Expected Delivery: ${new Date(order.expectedDeliveryDate).toLocaleDateString()}\n` : ''}\nItems Ordered:\n${itemsList}\n\nWe'll keep you updated on the status of your order.\n\nBest regards,\nThe Team`;
  
  await emailService.sendGenericEmail({
    from: fromAddress,
    to: order.customerEmail,
    subject,
    text,
    html,
  });
}

export async function sendOrderArrivedEmail(
  order: { orderNumber: string; customerName: string; customerEmail: string | null; actualDeliveryDate?: string | null },
  orderItems: Array<{ itemName: string; quantity: number; itemType: string }>
): Promise<void> {
  if (!order.customerEmail) {
    console.warn(`Cannot send order arrived email - no customer email for order ${order.orderNumber}`);
    return;
  }

  const emailService = new EmailService();
  const fromAddress = emailService.getFromAddress();
  
  const subject = `Your Order is Ready - ${order.orderNumber}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #22c55e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .cta { display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Order is Ready!</h1>
    </div>
    <div class="content">
      <p>Dear ${order.customerName},</p>
      <p>Great news! Your order has arrived and is ready for pickup.</p>
      
      <div class="order-info">
        <h3>Order Details</h3>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Arrival Date:</strong> ${order.actualDeliveryDate ? new Date(order.actualDeliveryDate).toLocaleDateString() : 'Today'}</p>
      </div>

      <p>Please visit us during our business hours to collect your order. If you have any questions or need to arrange a different pickup time, please contact us.</p>
      
      <p>Best regards,<br>The Team</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const text = `Your Order is Ready - ${order.orderNumber}\n\nDear ${order.customerName},\n\nGreat news! Your order has arrived and is ready for pickup.\n\nOrder Details:\n- Order Number: ${order.orderNumber}\n- Arrival Date: ${order.actualDeliveryDate ? new Date(order.actualDeliveryDate).toLocaleDateString() : 'Today'}\n\nPlease visit us during our business hours to collect your order.\n\nBest regards,\nThe Team`;
  
  await emailService.sendGenericEmail({
    from: fromAddress,
    to: order.customerEmail,
    subject,
    text,
    html,
  });
}