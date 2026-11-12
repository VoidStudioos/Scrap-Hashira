import Dexie, { type Table } from 'dexie';
import type {
  BlobEntry,
  ExtractedRecord,
  Job,
  PageTask,
  PageSnapshot,
  Profile,
  ResourceTask,
  LogEntry,
  SelectedElement,
} from '../types';
export class HashiraDB extends Dexie {
  jobs!: Table<Job, string>;
  pages!: Table<PageTask, string>;
  snapshots!: Table<PageSnapshot, string>;
  records!: Table<ExtractedRecord, string>;
  resources!: Table<ResourceTask, string>;
  blobs!: Table<BlobEntry, string>;
  profiles!: Table<Profile, string>;
  logs!: Table<LogEntry, number>;
  selections!: Table<SelectedElement & { id: string; at: number }, string>;
  constructor(name = 'hashira-scraper') {
    super(name);
    this.version(1).stores({
      jobs: 'id,state,updatedAt',
      pages: 'id,state,jobId,[jobId+state],[jobId+url],leaseUntil',
      snapshots: 'id,jobId,[jobId+fingerprint]',
      records: 'id,jobId,sourceUrl',
      resources: 'id,jobId,[jobId+state],hash,downloadId',
      blobs: 'hash',
      profiles: 'id,origin,updatedAt',
      logs: '++id,jobId,at',
      selections: 'id,at',
    });
  }
}
export const db = new HashiraDB();
export async function log(
  jobId: string,
  level: LogEntry['level'],
  code: string,
  message: string,
  url?: string,
) {
  await db.logs.add({ jobId, level, code, message, url, at: Date.now() });
}
export async function stats(jobId?: string) {
  const records = jobId
    ? await db.records.where('jobId').equals(jobId).count()
    : await db.records.count();
  const pages = jobId
    ? await db.pages.where('jobId').equals(jobId).toArray()
    : await db.pages.toArray();
  const resources = jobId
    ? await db.resources.where('jobId').equals(jobId).toArray()
    : await db.resources.toArray();
  const snapshots = jobId
    ? await db.snapshots.where('jobId').equals(jobId).toArray()
    : await db.snapshots.toArray();
  return {
    discovered: pages.length,
    processed: pages.filter((p) => p.state === 'DONE').length,
    records,
    tables: snapshots.reduce((n, p) => n + p.tables.length, 0),
    videosDownloaded: resources.filter((r) => r.kind === 'video' && r.state === 'COMPLETED').length,
    videos: resources.filter((r) => r.kind === 'video').length,
    images: resources.filter((r) => r.kind === 'image').length,
    downloaded: resources.filter((r) => r.kind === 'image' && r.state === 'COMPLETED').length,
    failed: resources.filter((r) => r.state === 'FAILED' || r.state === 'BLOCKED').length,
  };
}
