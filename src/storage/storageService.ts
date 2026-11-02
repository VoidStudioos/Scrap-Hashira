import { db, type PageSnapshot } from './db';
import type {
  ScrapingJob,
  SiteProfile,
  ExtractedRecord,
  ExtractedTable,
  ExtractedImage,
  CrawlQueueItem,
  JobState,
  PerformanceConfig,
  LogEntry,
} from '../types';

export const defaultPerformanceConfig: PerformanceConfig = {
  mode: 'BALANCED',
  maxConcurrentPages: 3,
  maxConcurrentDownloads: 4,
  requestDelayMs: 600,
  retryCount: 3,
  timeoutMs: 15000,
  maxCrawlDepth: 3,
  maxPages: 100,
  maxImages: 500,
  memoryBudgetMb: 256,
};

export class StorageService {
  // Job Management
  static async createJob(startingUrl: string, name?: string, config?: Partial<PerformanceConfig>): Promise<ScrapingJob> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job: ScrapingJob = {
      id,
      name: name || `Job ${new Date().toLocaleTimeString()} - ${new URL(startingUrl).hostname}`,
      startingUrl,
      state: 'CREATED',
      config: { ...defaultPerformanceConfig, ...(config || {}) },
      stats: {
        pagesDiscovered: 1,
        pagesProcessed: 0,
        recordsExtracted: 0,
        tablesExtracted: 0,
        imagesDiscovered: 0,
        imagesDownloaded: 0,
        downloadFailures: 0,
        storageUsedBytes: 0,
      },
      errorHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.jobs.add(job);
    await db.queue.add({
      jobId: id,
      url: startingUrl,
      depth: 0,
      type: 'catalog',
      status: 'pending',
      discoveredAt: Date.now(),
      retryCount: 0,
    });

    await this.log(id, 'info', `Created scraping job for ${startingUrl}`);
    return job;
  }

  static async getJob(id: string): Promise<ScrapingJob | undefined> {
    return await db.jobs.get(id);
  }

  static async getAllJobs(): Promise<ScrapingJob[]> {
    return await db.jobs.orderBy('createdAt').reverse().toArray();
  }

  static async updateJobState(id: string, state: JobState, errorMsg?: string): Promise<void> {
    const job = await db.jobs.get(id);
    if (!job) return;

    const updates: Partial<ScrapingJob> = {
      state,
      updatedAt: Date.now(),
    };

    if (state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED') {
      updates.completedAt = Date.now();
    }

    if (errorMsg) {
      job.errorHistory.push({
        timestamp: Date.now(),
        message: errorMsg,
      });
      updates.errorHistory = job.errorHistory;
    }

    await db.jobs.update(id, updates);
    await this.log(id, state === 'FAILED' ? 'error' : 'info', `Job state changed to ${state}${errorMsg ? `: ${errorMsg}` : ''}`);
  }

  static async updateJobStats(id: string, statDiff: Partial<ScrapingJob['stats']>): Promise<void> {
    const job = await db.jobs.get(id);
    if (!job) return;

    const newStats = { ...job.stats };
    for (const [key, val] of Object.entries(statDiff)) {
      if (typeof val === 'number') {
        (newStats as any)[key] = ((newStats as any)[key] || 0) + val;
      }
    }

    await db.jobs.update(id, { stats: newStats, updatedAt: Date.now() });
  }

  static async deleteJob(id: string): Promise<void> {
    await db.transaction('rw', [db.jobs, db.records, db.extractedTables, db.images, db.queue, db.logs, db.snapshots], async () => {
      await db.jobs.delete(id);
      await db.records.where('jobId').equals(id).delete();
      await db.extractedTables.where('jobId').equals(id).delete();
      await db.images.where('jobId').equals(id).delete();
      await db.queue.where('jobId').equals(id).delete();
      await db.logs.where('jobId').equals(id).delete();
      await db.snapshots.where('jobId').equals(id).delete();
    });
  }

  // Records
  static async addRecords(records: ExtractedRecord[]): Promise<void> {
    if (!records.length) return;
    await db.records.bulkAdd(records);
    await this.updateJobStats(records[0].jobId, { recordsExtracted: records.length });
  }

  static async getRecordsForJob(jobId: string): Promise<ExtractedRecord[]> {
    return await db.records.where('jobId').equals(jobId).toArray();
  }

  // Tables
  static async addTables(tables: ExtractedTable[]): Promise<void> {
    if (!tables.length) return;
    await db.extractedTables.bulkAdd(tables);
    await this.updateJobStats(tables[0].jobId, { tablesExtracted: tables.length });
  }

  static async getTablesForJob(jobId: string): Promise<ExtractedTable[]> {
    return await db.extractedTables.where('jobId').equals(jobId).toArray();
  }

  // Images
  static async addImages(images: ExtractedImage[]): Promise<void> {
    if (!images.length) return;
    await db.images.bulkAdd(images);
    await this.updateJobStats(images[0].jobId, { imagesDiscovered: images.length });
  }

  static async getImagesForJob(jobId: string): Promise<ExtractedImage[]> {
    return await db.images.where('jobId').equals(jobId).toArray();
  }

  static async updateImage(id: number, updates: Partial<ExtractedImage>): Promise<void> {
    await db.images.update(id, updates);
  }

  // Profiles (Smart Learning)
  static async saveProfile(profile: Omit<SiteProfile, 'id'>): Promise<number> {
    const existing = await db.profiles
      .where('domain')
      .equals(profile.domain)
      .and((p) => p.urlPattern === profile.urlPattern)
      .first();

    if (existing && existing.id) {
      await db.profiles.update(existing.id, {
        ...profile,
        updatedAt: Date.now(),
      });
      return existing.id;
    }

    return await db.profiles.add({
      ...profile,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static async getProfilesForDomain(domain: string): Promise<SiteProfile[]> {
    return await db.profiles.where('domain').equals(domain).toArray();
  }

  static async getAllProfiles(): Promise<SiteProfile[]> {
    return await db.profiles.toArray();
  }

  static async deleteProfile(id: number): Promise<void> {
    await db.profiles.delete(id);
  }

  // Queue Operations
  static async enqueueUrl(jobId: string, url: string, depth: number, type: 'catalog' | 'detail' | 'pagination'): Promise<boolean> {
    const existing = await db.queue.where('jobId').equals(jobId).and((q) => q.url === url).first();
    if (existing) return false;

    await db.queue.add({
      jobId,
      url,
      depth,
      type,
      status: 'pending',
      discoveredAt: Date.now(),
      retryCount: 0,
    });
    await this.updateJobStats(jobId, { pagesDiscovered: 1 });
    return true;
  }

  static async getNextQueueItem(jobId: string): Promise<CrawlQueueItem | undefined> {
    return await db.queue
      .where('[jobId+status]')
      .equals([jobId, 'pending'])
      .first();
  }

  static async updateQueueStatus(id: number, status: CrawlQueueItem['status'], error?: string): Promise<void> {
    await db.queue.update(id, {
      status,
      error,
      processedAt: status === 'completed' || status === 'failed' ? Date.now() : undefined,
    });
  }

  // Snapshots
  static async saveSnapshot(snapshot: PageSnapshot): Promise<number> {
    return await db.snapshots.add(snapshot);
  }

  static async getSnapshotsForJob(jobId: string): Promise<PageSnapshot[]> {
    return await db.snapshots.where('jobId').equals(jobId).toArray();
  }

  // Logging
  static async log(jobId: string | undefined, level: LogEntry['level'], message: string, details?: any): Promise<void> {
    try {
      await db.logs.add({
        jobId,
        level,
        message,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        timestamp: Date.now(),
      });
    } catch {
      // Fallback
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  static async getLogs(jobId?: string, limit: number = 100): Promise<LogEntry[]> {
    if (jobId) {
      return await db.logs.where('jobId').equals(jobId).reverse().limit(limit).toArray();
    }
    return await db.logs.orderBy('timestamp').reverse().limit(limit).toArray();
  }
}
