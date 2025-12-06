import { EmailService } from './emailService';

export class SchedulerService {
  private emailService: EmailService;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.emailService = new EmailService();
  }

  start() {
    console.log('Starting scheduler service...');
    
    // Schedule weekly callback report every Monday at 9:00 AM
    this.scheduleWeeklyCallbackReport();
    
    // Schedule message cleanup (delete messages older than 3 months) - runs daily at 2:00 AM
    this.scheduleMessageCleanup();
    
    console.log('Scheduler service started successfully');
  }

  stop() {
    console.log('Stopping scheduler service...');
    
    // Clear all intervals
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`Stopped ${name} schedule`);
    });
    
    this.intervals.clear();
    console.log('Scheduler service stopped');
  }

  private scheduleWeeklyCallbackReport() {
    // Calculate time until next Monday 9:00 AM
    const now = new Date();
    const nextMonday = new Date();
    
    // Get next Monday
    const daysUntilMonday = (1 + 7 - now.getDay()) % 7;
    nextMonday.setDate(now.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
    nextMonday.setHours(9, 0, 0, 0);
    
    // If it's already past 9 AM on Monday, schedule for next Monday
    if (now.getDay() === 1 && now.getHours() >= 9) {
      nextMonday.setDate(nextMonday.getDate() + 7);
    }
    
    const timeUntilNext = nextMonday.getTime() - now.getTime();
    
    console.log(`Next weekly callback report scheduled for: ${nextMonday.toLocaleString()}`);
    
    // Schedule first execution
    setTimeout(() => {
      this.sendWeeklyCallbackReport();
      
      // Then schedule weekly recurring execution (every 7 days)
      const weeklyInterval = setInterval(() => {
        this.sendWeeklyCallbackReport();
      }, 7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds
      
      this.intervals.set('weeklyCallbackReport', weeklyInterval);
    }, timeUntilNext);
  }

  private async sendWeeklyCallbackReport() {
    try {
      console.log('Sending weekly callback report...');
      // For scheduled reports, we need to send for all businesses
      // Get all active businesses and send report for each
      const { storage } = await import('../storage');
      const businesses = await storage.getAllBusinesses();
      
      let allSuccessful = true;
      for (const business of businesses.filter((b: { isActive: boolean }) => b.isActive)) {
        console.log(`Sending callback report for business: ${business.name} (ID: ${business.id})`);
        const success = await this.emailService.sendWeeklyCallbackReport(business.id);
        if (!success) {
          allSuccessful = false;
        }
      }
      
      if (allSuccessful) {
        console.log('Weekly callback report sent successfully for all businesses');
      } else {
        console.error('Some weekly callback reports failed');
      }
    } catch (error) {
      console.error('Error in weekly callback report scheduler:', error);
    }
  }

  // Manual trigger for testing - requires businessId
  async triggerWeeklyCallbackReport(businessId: number): Promise<boolean> {
    console.log(`Manually triggering weekly callback report for business ${businessId}...`);
    return await this.emailService.sendWeeklyCallbackReport(businessId);
  }

  private scheduleMessageCleanup() {
    // Calculate time until next 2:00 AM
    const now = new Date();
    const nextCleanup = new Date();
    nextCleanup.setHours(2, 0, 0, 0);
    
    // If it's already past 2 AM today, schedule for tomorrow
    if (now.getHours() >= 2) {
      nextCleanup.setDate(nextCleanup.getDate() + 1);
    }
    
    const timeUntilNext = nextCleanup.getTime() - now.getTime();
    
    console.log(`Next message cleanup scheduled for: ${nextCleanup.toLocaleString()}`);
    
    // Schedule first execution
    setTimeout(() => {
      this.cleanupOldMessages();
      
      // Then schedule daily recurring execution (every 24 hours)
      const dailyInterval = setInterval(() => {
        this.cleanupOldMessages();
      }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
      
      this.intervals.set('messageCleanup', dailyInterval);
    }, timeUntilNext);
  }

  private async cleanupOldMessages() {
    try {
      console.log('Starting message cleanup (deleting messages older than 3 months)...');
      const { storage } = await import('../storage');
      const deletedCount = await storage.deleteOldMessages(3);
      console.log(`Message cleanup completed. Deleted ${deletedCount} messages older than 3 months.`);
    } catch (error) {
      console.error('Error in message cleanup scheduler:', error);
    }
  }

  // Manual trigger for testing
  async triggerMessageCleanup(): Promise<number> {
    console.log('Manually triggering message cleanup...');
    const { storage } = await import('../storage');
    return await storage.deleteOldMessages(3);
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();