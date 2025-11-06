import { MailerSend, EmailParams, Recipient, Sender } from "mailersend";

async function testCorrectedEmail() {
    console.log("Testing corrected MailerSend implementation...");
    
    if (!process.env.MAILERSEND_API_KEY) {
        console.log("No MAILERSEND_API_KEY found");
        return;
    }

    try {
        const mailersend = new MailerSend({
            apiKey: process.env.MAILERSEND_API_KEY,
        });

        const recipients = [new Recipient("matthew1111moore@gmail.com", "Test Customer")];
        const sentFrom = new Sender("workshop@moorelink.co.uk", "Moore Horticulture Equipment");

        const personalization = [
            {
                email: "matthew1111moore@gmail.com",
                data: {
                    order_number: "TEST-FINAL",
                },
            }
        ];

        const emailParams = new EmailParams()
            .setFrom(sentFrom)
            .setTo(recipients)
            .setSubject("Final Test - Job Receipt")
            .setTemplateId("z86org8y8oklew13")
            .setPersonalization(personalization);

        console.log("Sending final test email...");
        const result = await mailersend.email.send(emailParams);
        console.log("SUCCESS! Email sent successfully:", result);
        return true;

    } catch (error) {
        console.error("Error:", error);
        if (error?.body?.message) {
            console.error("MailerSend error:", error.body.message);
        }
        return false;
    }
}

testCorrectedEmail();