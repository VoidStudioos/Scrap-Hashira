// Crash-Proof Resume Engine: Durable state recovery and MV3 Service Worker persistence
import { StorageService } from '../../storage/storageService';
import { db } from '../../storage/db';
import type { ScrapingJob, JobCheckpoint } from '../../types';

export class ResumeEngine {
  private static readonly ALARM_NAME = 'hashira_job_watchdog';

  /**
   * Initializes MV3 watchdog alarm to keep queue alive or detect termination
   */
  static setupWatchdog(): void {
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.create(this.ALARM_NAME, {
        periodInMinutes: 1, // Periodic check every minute
      });

      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === this.ALARM_NAME) {
          this.checkAndRecoverInterruptedJobs();
        }
      });
    }
  }

  /**
   * Scans database on startup/wake for any jobs left in RUNNING state without active worker
   */
  static async checkAndRecoverInterruptedJobs(): Promise<ScrapingJob[]> {
    const runningJobs = await db.jobs.where('state').equals('RUNNING').toArray();
    const interruptedJobs: ScrapingJob[] = [];

    for (const job of runningJobs) {
      // If job has not been updated for more than 2 minutes, mark as INTERRUPTED
      const isStale = Date.now() - job.updatedAt > 120000;
      if (isStale) {
        await StorageService.updateJobState(job.id, 'INTERRUPTED', 'Browser session or worker terminated unexpectedly');
        interruptedJobs.push({ ...job, state: 'INTERRUPTED' });
      }
    }

    return interruptedJobs;
  }

  /**
   * Restores an interrupted or paused job by verifying completed queue items and resuming pending ones
   */
  static async resumeJob(jobId: string): Promise<{
    success: boolean;
    pendingPages: number;
    completedPages: number;
    message: string;
  }> {
    const job = await StorageService.getJob(jobId);
    if (!job) {
      return { success: false, pendingPages: 0, completedPages: 0, message: 'Job not found' };
    }

    // Reset any items that were stuck in 'processing' back to 'pending'
    await db.queue
      .where('jobId')
      .equals(jobId)
      .and((item) => item.status === 'processing')
      .modify({ status: 'pending' });

    const pendingCount = await db.queue
      .where('jobId')
      .equals(jobId)
      .and((item) => item.status === 'pending')
      .count();

    const completedCount = await db.queue
      .where('jobId')
      .equals(jobId)
      .and((item) => item.status === 'completed')
      .count();

    if (pendingCount === 0) {
      await StorageService.updateJobState(jobId, 'COMPLETED');
      return {
        success: true,
        pendingPages: 0,
        completedPages: completedCount,
        message: 'No pending pages remaining. Job marked as completed.',
      };
    }

    await StorageService.updateJobState(jobId, 'RUNNING');
    await StorageService.log(jobId, 'info', `Resumed job with ${pendingCount} pending pages.`);

    return {
      success: true,
      pendingPages: pendingCount,
      completedPages: completedCount,
      message: `Resumed job successfully. ${pendingCount} pages pending.`,
    };
  }

  /**
   * Creates a durable checkpoint snapshot for a job
   */
  static async createCheckpoint(jobId: string): Promise<JobCheckpoint | null> {
    const job = await StorageService.getJob(jobId);
    if (!job) return null;

    const pendingPagesCount = await db.queue
      .where('jobId')
      .equals(jobId)
      .and((item) => item.status === 'pending')
      .count();

    const lastItem = await db.queue
      .where('jobId')
      .equals(jobId)
      .and((item) => item.status === 'completed')
      .reverse()
      .first();

    const checkpoint: JobCheckpoint = {
      jobId,
      state: job.state,
      processedPagesCount: job.stats.pagesProcessed,
      pendingPagesCount,
      completedRecordsCount: job.stats.recordsExtracted,
      completedDownloadsCount: job.stats.imagesDownloaded,
      failedDownloadsCount: job.stats.downloadFailures,
      lastUrlProcessed: lastItem?.url || job.startingUrl,
      timestamp: Date.now(),
    };

    return checkpoint;
  }
}
