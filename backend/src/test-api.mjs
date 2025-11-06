import { MailerSend, EmailParams, Recipient, Sender } from "mailersend";

async function testApiStructure() {
    console.log("Testing MailerSend API structure...");
    
    const mailersend = new MailerSend({
        apiKey: process.env.MAILERSEND_API_KEY || "test",
    });

    console.log("MailerSend methods available:");
    console.log("- mailersend.email exists:", typeof mailersend.email);
    console.log("- mailersend.send exists:", typeof mailersend.send);
    
    const emailParams = new EmailParams();
    console.log("EmailParams methods available:");
    console.log("- setFrom exists:", typeof emailParams.setFrom);
    console.log("- setTo exists:", typeof emailParams.setTo);
    console.log("- setRecipients exists:", typeof emailParams.setRecipients);
    console.log("- setFromName exists:", typeof emailParams.setFromName);
    console.log("- setSubject exists:", typeof emailParams.setSubject);
    console.log("- setTemplateId exists:", typeof emailParams.setTemplateId);
    console.log("- setPersonalization exists:", typeof emailParams.setPersonalization);
}

testApiStructure();