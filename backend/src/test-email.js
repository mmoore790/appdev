// Simple test script to debug MailerSend API
const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");

async function testEmail() {
    console.log("Testing MailerSend API...");
    console.log("API Key exists:", !!process.env.MAILERSEND_API_KEY);
    
    if (!process.env.MAILERSEND_API_KEY) {
        console.log("No API key found");
        return;
    }

    const mailersend = new MailerSend({
        apiKey: process.env.MAILERSEND_API_KEY,
    });

    const recipients = [new Recipient("test@example.com", "Test User")];

    const personalization = [
        {
            email: "test@example.com",
            data: {
                order_number: "TEST-123"
            },
        }
    ];

    const emailParams = new EmailParams()
        .setFrom(new Sender("info@moorehorticulture.com", "Moore Horticulture Equipment"))
        .setRecipients(recipients)
        .setSubject("Test Email")
        .setTemplateId("z86org8y8oklew13")
        .setPersonalization(personalization);

    try {
        const result = await mailersend.send(emailParams);
        console.log("Email sent successfully:", result);
    } catch (error) {
        console.error("Email failed:", error);
    }
}

testEmail();