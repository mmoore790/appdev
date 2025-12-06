import nodemailer = require('nodemailer');
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import { Resend } from "resend";
import { storage } from '../storage';
import { format } from 'date-fns';

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
  private mailerSend: MailerSend | null = null;
  private resend: Resend | null = null;

  constructor() {
    // Prefer Resend if API key is available
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      console.log("✅ Email service initialized with Resend");
    }
    // Try to use MailerSend next if API key is available
    else if (process.env.MAILERSEND_API_KEY) {
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
    if (!this.mailerSend) {
      throw new Error('MailerSend not initialized');
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
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Booking Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2d5a2d; }
        .logo { color: #2d5a2d; font-size: 28px; font-weight: bold; margin-bottom: 5px; }
        .tagline { color: #666; font-size: 14px; }
        .success-badge { background-color: #d4edda; color: #155724; padding: 12px; border-radius: 6px; margin-bottom: 25px; text-align: center; font-weight: bold; }
        .job-details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 25px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .detail-label { font-weight: bold; color: #2d5a2d; }
        .detail-value { color: #333; }
        .info-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .contact-info { background-color: #e7f5ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center; font-size: 12px; color: #666; }
        .important { font-weight: bold; color: #856404; }
        h3 { color: #2d5a2d; margin-top: 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">MOORE HORTICULTURE EQUIPMENT</div>
            <div class="tagline">Professional Equipment Sales & Service</div>
        </div>

        <div class="success-badge">
            ✓ Job Successfully Booked
        </div>

        <p>Dear ${customer.name},</p>

        <p>Thank you for choosing Moore Horticulture Equipment. We have received your service request and your job has been successfully booked into our system.</p>

        <div class="job-details">
            <h3 style="margin-top: 0; color: #2d5a2d;">Job Details</h3>
            <div class="detail-row">
                <span class="detail-label">Job ID:</span>
                <span class="detail-value"><strong>${job.jobId}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Booking Date:</span>
                <span class="detail-value">${createdDate}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Equipment:</span>
                <span class="detail-value">${job.equipmentDescription || 'To be assessed'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">${job.status === 'waiting_assessment' ? 'Waiting Assessment' : job.status}</span>
            </div>
            ${job.description ? `
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${job.description}</span>
            </div>
            ` : ''}
        </div>

        <div class="info-box">
            <h3 style="margin-top: 0; color: #856404;">What Happens Next?</h3>
            <p style="margin: 0;">Our team will assess your equipment and contact you with:</p>
            <ul style="margin: 10px 0;">
                <li>Estimated repair time</li>
                <li>Quote for any required work</li>
                <li>Updates on the job progress</li>
            </ul>
            <p class="important">Please keep your Job ID (${job.jobId}) for reference.</p>
        </div>

        <div class="contact-info">
            <h3 style="margin-top: 0; color: #0066cc;">Track Your Job Online</h3>
            <p>You can track the progress of your job anytime using our online job tracker:</p>
            <p><strong>Job ID:</strong> ${job.jobId}<br>
            <strong>Email:</strong> ${customer.email}</p>
        </div>

        <div class="contact-info">
            <h3 style="margin-top: 0; color: #0066cc;">Need to Contact Us?</h3>
            <p>If you have any questions or need to provide additional information:</p>
            <p><strong>Phone:</strong> 01580 212222<br>
            <strong>Email:</strong> info@mooresmowers.co.uk</p>
        </div>

        <p>Thank you for choosing Moore Horticulture Equipment. We look forward to serving you!</p>

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