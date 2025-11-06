import { MailerSend, EmailParams, Recipient } from "mailersend";

async function testFinalEmail() {
    console.log("Final MailerSend test with corrected implementation...");
    
    if (!process.env.MAILERSEND_API_KEY) {
        console.log("No MAILERSEND_API_KEY found");
        return;
    }

    try {
        // Initialize exactly like the working example
        const mailersend = new MailerSend({
            apiKey: process.env.MAILERSEND_API_KEY,
        });

        // Create recipients exactly like the working example
        const recipients = [new Recipient("matthew1111moore@gmail.com", "Test Customer")];

        // Create personalization exactly like the working example
        const personalization = [
            {
                email: "matthew1111moore@gmail.com",
                data: {
                    order_number: "TEST-999",
                },
            }
        ];

        // Build email parameters exactly like the working example
        const emailParams = new EmailParams()
            .setFrom("workshop@moorelink.co.uk")
            .setFromName("Moore Horticulture Equipment")
            .setRecipients(recipients)
            .setSubject("Test Job Receipt")
            .setTemplateId("z86org8y8oklew13")
            .setPersonalization(personalization);

        console.log("Sending test email with corrected implementation...");
        
        // Send exactly like the working example
        const result = await mailersend.send(emailParams);
        console.log("SUCCESS! Email sent:", result);

    } catch (error) {
        console.error("Error:", error);
        if (error?.body?.message) {
            console.error("Error message:", error.body.message);
        }
    }
}

testFinalEmail();