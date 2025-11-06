import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

async function testMailerSend() {
    console.log("Testing MailerSend API...");
    
    if (!process.env.MAILERSEND_API_KEY) {
        console.log("No MAILERSEND_API_KEY found");
        return;
    }
    
    console.log("API Key format check:");
    console.log("- Length:", process.env.MAILERSEND_API_KEY.length);
    console.log("- Starts with 'mlsn.':", process.env.MAILERSEND_API_KEY.startsWith('mlsn.'));
    console.log("- First 10 chars:", process.env.MAILERSEND_API_KEY.substring(0, 10));

    try {
        const mailerSend = new MailerSend({
            apiKey: process.env.MAILERSEND_API_KEY,
        });

        const recipients = [
            new Recipient("matthew1111moore@gmail.com", "Test Customer")
        ];

        // Try with a verified domain first
        const sentFrom = new Sender("info@trial-0p7kx4xjv4jg9yjr.mlsender.net", "Moore Horticulture Equipment");

        const personalization = [
            {
                email: "matthew1111moore@gmail.com",
                data: {
                    order_number: "TEST-123",
                },
            }
        ];

        const emailParams = new EmailParams()
            .setFrom(sentFrom)
            .setTo(recipients)
            .setSubject("Test Job Receipt")
            .setTemplateId("z86org8y8oklew13")
            .setPersonalization(personalization);

        console.log("Sending test email...");
        const result = await mailerSend.email.send(emailParams);
        console.log("Success:", result);

    } catch (error) {
        console.error("Error:", error);
        console.error("Error message:", error.message);
        console.error("Error status:", error.status);
        console.error("Error body:", error.body);
    }
}

testMailerSend();