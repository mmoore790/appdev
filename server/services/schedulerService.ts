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
      const success = await this.emailService.sendWeeklyCallbackReport();
      
      if (success) {
        console.log('Weekly callback report sent successfully');
      } else {
        console.error('Failed to send weekly callback report');
      }
    } catch (error) {
      console.error('Error in weekly callback report scheduler:', error);
    }
  }

  // Manual trigger for testing
  async triggerWeeklyCallbackReport(): Promise<boolean> {
    console.log('Manually triggering weekly callback report...');
    return await this.emailService.sendWeeklyCallbackReport();
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();