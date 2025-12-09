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

export async function sendJobBookedEmail(job: any, customer: any, business?: any): Promise<boolean> {
  try {
    if (!customer.email) {
      console.log('No customer email provided, skipping job receipt email');
      return false;
    }

    const emailContent = generateJobBookedHTML(job, customer, business);
    const textContent = generateJobBookedText(job, customer, business);

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

function generateJobBookedHTML(job: any, customer: any, business?: any): string {
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
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Booking Confirmation - ${job.jobId}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2d5a2d; }
        .logo { color: #2d5a2d; font-size: 28px; font-weight: bold; margin-bottom: 5px; }
        .tagline { color: #666; font-size: 14px; }
        .success-badge { background-color: #d4edda; color: #155724; padding: 12px; border-radius: 6px; margin-bottom: 25px; text-align: center; font-weight: bold; }
        .job-details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 25px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: bold; color: #2d5a2d; }
        .detail-value { color: #333; text-align: right; }
        .customer-info { background-color: #e7f3ff; padding: 20px; border-radius: 6px; margin-bottom: 25px; border-left: 4px solid #007bff; }
        .equipment-info { background-color: #fff3cd; padding: 20px; border-radius: 6px; margin-bottom: 25px; border-left: 4px solid #ffc107; }
        .next-steps { background-color: #f0f0f0; padding: 20px; border-radius: 6px; margin-bottom: 25px; }
        .contact-info { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 25px; border-left: 4px solid #2d5a2d; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        .tracker-button { display: inline-block; padding: 12px 24px; background-color: #2d5a2d; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: bold; }
        .tracker-button:hover { background-color: #1e3d1e; }
        .important { color: #dc3545; font-weight: bold; }
        @media only screen and (max-width: 600px) {
            .container { padding: 15px; }
            .detail-row { flex-direction: column; }
            .detail-value { text-align: left; margin-top: 5px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">${companyName.toUpperCase()}</div>
            <div class="tagline">Professional Equipment Sales & Service</div>
        </div>

        <div class="success-badge">
            ✓ Job Successfully Booked - Machine Received
        </div>

        <p>Dear ${customer.name},</p>

        <p>Thank you for choosing ${companyName}. We have successfully received your ${job.equipmentDescription ? 'equipment' : 'machine'} and your service job has been booked into our system.</p>

        <div class="job-details">
            <h3 style="margin-top: 0; color: #2d5a2d;">Job Details</h3>
            <div class="detail-row">
                <span class="detail-label">Job Reference:</span>
                <span class="detail-value"><strong>${job.jobId}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Booking Date:</span>
                <span class="detail-value">${createdDate}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">${formatStatus(job.status)}</span>
            </div>
            ${job.description ? `
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${job.description}</span>
            </div>
            ` : ''}
        </div>

        <div class="equipment-info">
            <h3 style="margin-top: 0; color: #ffc107;">Equipment Received</h3>
            <p><strong>Equipment Description:</strong><br>
            ${job.equipmentDescription || 'To be assessed upon inspection'}</p>
            ${job.taskDetails ? `
            <p style="margin-top: 10px;"><strong>Work Required:</strong><br>
            ${job.taskDetails}</p>
            ` : ''}
        </div>

        <div class="customer-info">
            <h3 style="margin-top: 0; color: #007bff;">Customer Information</h3>
            <p><strong>Name:</strong> ${customer.name}</p>
            ${customer.phone ? `<p><strong>Phone:</strong> ${customer.phone}</p>` : ''}
            ${customer.address ? `<p><strong>Address:</strong> ${customer.address}</p>` : ''}
            <p><strong>Email:</strong> ${customer.email}</p>
        </div>

        <div class="next-steps">
            <h3 style="margin-top: 0;">What Happens Next?</h3>
            <p>Our experienced team will now:</p>
            <ul>
                <li>Thoroughly assess your equipment</li>
                <li>Identify any issues or required maintenance</li>
                <li>Contact you with a detailed quote for any work needed</li>
                <li>Keep you updated on the progress of your job</li>
            </ul>
            <p class="important">Please keep your Job Reference (${job.jobId}) for future reference.</p>
        </div>

        ${trackerEnabled && trackerUrl ? `
        <div style="text-align: center; margin: 25px 0;">
            <p>Track your job progress online:</p>
            <a href="${trackerUrl}" class="tracker-button">Track Job Status</a>
        </div>
        ` : ''}

        <div class="contact-info">
            <h3 style="margin-top: 0; color: #2d5a2d;">Contact Us</h3>
            <p>If you have any questions or need to provide additional information, please don't hesitate to contact us:</p>
            <p><strong>Phone:</strong> ${companyPhone}<br>
            <strong>Email:</strong> ${companyEmail}</p>
            ${companyAddress ? `<p><strong>Address:</strong><br>${companyAddress}</p>` : ''}
            ${companyWebsite ? `<p><strong>Website:</strong> <a href="${companyWebsite}" style="color: #2d5a2d;">${companyWebsite}</a></p>` : ''}
        </div>

        <p>Thank you for choosing ${companyName}. We look forward to serving you and getting your equipment back in perfect working order!</p>

        <p>Best regards,<br>
        <strong>The ${companyName} Team</strong></p>

        <div class="footer">
            <p>This email was sent automatically from the ${companyName} Management System on ${currentDate}.</p>
            <p>If you believe you received this email in error, please contact us immediately.</p>
        </div>
    </div>
</body>
</html>
  `;
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