import { EmailService } from './emailService';

export class SchedulerService {
  private emailService: EmailService;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.emailService = new EmailService();
  }

  start() {
    console.log('Starting scheduler service...');
    
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