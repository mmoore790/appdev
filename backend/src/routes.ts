import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { initAuthRoutes, isAuthenticated } from "./auth";
import { userController } from "./controllers/userController";
import { customerController } from "./controllers/customerController";
import { equipmentController } from "./controllers/equipmentController";
import { jobController, jobUtilityController } from "./controllers/jobController";
import { serviceRecordController } from "./controllers/serviceRecordController";
import { taskController } from "./controllers/taskController";
import { callbackController } from "./controllers/callbackController";
import { activityController } from "./controllers/activityController";
import { analyticsController } from "./controllers/analyticsController";
import { workCompletedController } from "./controllers/workCompletedController";
import { jobSheetController } from "./controllers/jobSheetController";
import { orderController } from "./controllers/orderController";
import { paymentController } from "./controllers/paymentController";
import { timeEntryController } from "./controllers/timeEntryController";
import { masterController } from "./controllers/masterController";
import { announcementController } from "./controllers/announcementController";
import { businessController } from "./controllers/businessController";
import { messageController } from "./controllers/messageController";
import { notificationController } from "./controllers/notificationController";

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("[Routes] Initializing auth routes...");
  await initAuthRoutes(app);
  console.log("[Routes] Auth routes initialized");

  app.get("/api/user", isAuthenticated, (req: Request, res: Response) => {
    res.json((req.session as any).user);
  });

  app.use("/api/users", userController.router);
  app.use("/api/customers", customerController.router);
  app.use("/api/equipment", equipmentController.router);
  app.use("/api/jobs", jobController.router);
  app.use("/api", jobUtilityController.router);
  app.use("/api/services", serviceRecordController.router);
  app.use("/api/tasks", taskController.router);
  app.use("/api/callbacks", callbackController.router);
  app.use("/api/activities", activityController.router);
  app.use("/api/analytics", analyticsController.router);
  app.use("/api/work-completed", workCompletedController.router);
  app.use("/api/job-sheet", jobSheetController.router);
  app.use("/api/orders", orderController.router);
  app.use("/api", paymentController.router);
  app.use("/api/time-entries", timeEntryController.router);
  app.use("/api/master", masterController.router);
  app.use("/api/announcements", announcementController.router);
  app.use("/api/business", businessController.router);
  app.use("/api/messages", messageController.router);
  app.use("/api/notifications", notificationController.router);

  app.get("/callback", (req: Request, res: Response) => {
    const { session_id } = req.query;

    if (session_id) {
      return res.redirect(`/payments/success?session_id=${session_id}`);
    }

    res.redirect("/payments/success");
  });

  app.get("/payments/success", (_req: Request, res: Response) => {
    const { session_id } = _req.query;

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Successful - Moore Horticulture Equipment</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
            .success { color: #22c55e; font-size: 24px; margin-bottom: 20px; }
            .message { color: #374151; margin-bottom: 30px; }
            .checkout-id { color: #6b7280; font-size: 14px; margin-bottom: 20px; font-family: monospace; }
            .button { background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px; }
            .secondary-button { background: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅ Payment Successful!</div>
            <div class="message">Your payment has been processed successfully. Thank you for your business with Moore Horticulture Equipment!</div>
            ${session_id ? `<div class="checkout-id">Session ID: ${session_id}</div>` : ""}
            <div>
              <a href="/" class="button">Return to Workshop</a>
              <a href="/job-tracker" class="button secondary-button">Track Your Job</a>
            </div>
          </div>
        </body>
      </html>
    `);
  });

  const httpServer = createServer(app);
  return httpServer;
}
