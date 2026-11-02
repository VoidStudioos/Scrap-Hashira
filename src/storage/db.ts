import Dexie, { type Table } from 'dexie';
import type {
  ScrapingJob,
  SiteProfile,
  ExtractedRecord,
  ExtractedTable,
  ExtractedImage,
  CrawlQueueItem,
  LogEntry,
} from '../types';

export interface PageSnapshot {
  id?: number;
  jobId: string;
  url: string;
  title: string;
  htmlContent: string;
  textContent: string;
  metadata: Record<string, any>;
  capturedAt: number;
}

export class HashiraDatabase extends Dexie {
  jobs!: Table<ScrapingJob, string>;
  profiles!: Table<SiteProfile, number>;
  records!: Table<ExtractedRecord, number>;
  extractedTables!: Table<ExtractedTable, number>;
  images!: Table<ExtractedImage, number>;
  queue!: Table<CrawlQueueItem, number>;
  logs!: Table<LogEntry, number>;
  snapshots!: Table<PageSnapshot, number>;

  constructor() {
    super('HashiraScraperDB');

    this.version(1).stores({
      jobs: 'id, state, createdAt, startingUrl',
      profiles: '++id, domain, urlPattern, pageType, updatedAt',
      records: '++id, jobId, sourceUrl, extractedAt',
      extractedTables: '++id, jobId, sourceUrl',
      images: '++id, jobId, sourceUrl, hashSha256, status, classification',
      queue: '++id, jobId, url, status, [jobId+status]',
      logs: '++id, jobId, level, timestamp',
      snapshots: '++id, jobId, url, capturedAt',
    });
  }
}

export const db = new HashiraDatabase();
