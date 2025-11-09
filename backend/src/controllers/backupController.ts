import { Router, Request, Response, NextFunction } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import {
  sendJobBackupEmail,
  getNextBackupEmailDate,
} from "../services/jobBackupService";

export class BackupController {
  public readonly router = Router();

  constructor() {
    this.router.post(
      "/send-job-backup",
      isAuthenticated,
      isAdmin,
      this.sendJobBackupEmail
    );
    this.router.get(
      "/next-backup-date",
      isAuthenticated,
      this.getNextBackupDate
    );
  }

  private async sendJobBackupEmail(_req: Request, res: Response, next: NextFunction) {
    try {
      const success = await sendJobBackupEmail();
      if (success) {
        res.json({ message: "Job backup email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send job backup email" });
      }
    } catch (error) {
      next(error);
    }
  }

  private async getNextBackupDate(_req: Request, res: Response, next: NextFunction) {
    try {
      const nextDate = getNextBackupEmailDate();
      res.json({ nextBackupDate: nextDate.toISOString() });
    } catch (error) {
      next(error);
    }
  }
}

export const backupController = new BackupController();
