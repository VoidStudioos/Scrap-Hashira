import { detect } from '../src/engines/detection';
import { db } from '../src/storage/db';
import { applyProfile, validateProfile } from '../src/engines/learning';
import { startSelector } from '../src/content/selector';
import { DEFAULT_CONFIG, type Job } from '../src/types';
import { sha256 } from '../src/utils/core';
import { sniffMime, readBounded, verifyImageBlob } from '../src/engines/images/verify';
const api = {
  detect,
  db,
  applyProfile,
  validateProfile,
  startSelector,
  DEFAULT_CONFIG,
  sha256,
  sniffMime,
  readBounded,
  verifyImageBlob,
  async seed(url: string) {
    const data = detect(document, url, { fullCapture: true });
    const job: Job = {
      id: 'browser-fixture',
      name: 'Persian لنت',
      state: 'PAUSED',
      startUrl: url,
      origin: new URL(url).origin,
      config: DEFAULT_CONFIG,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      checkpoint: 1,
      blockedUntil: 0,
    };
    await db.transaction('rw', [db.jobs, db.records, db.snapshots], async () => {
      await db.jobs.put(job);
      await db.records.bulkPut(
        data.records.map((r) => ({ ...r, id: job.id + ':' + r.id, jobId: job.id })),
      );
      await db.snapshots.put({
        id: job.id + ':page',
        jobId: job.id,
        url,
        title: data.title,
        at: Date.now(),
        fingerprint: data.fingerprint,
        html: data.html,
        text: data.text,
        metadata: data.metadata,
        semantic: data.semantic
          ? {
              ...data.semantic,
              fields: data.semantic.fields.map((f) => ({
                ...f,
                recordId: f.recordId ? job.id + ':' + f.recordId : undefined,
              })),
              imageLinks: data.semantic.imageLinks.map((l) => ({
                ...l,
                recordIds: l.recordIds.map((id) => job.id + ':' + id),
              })),
            }
          : undefined,
        structured: data.structured,
        embedded: data.embedded,
        tables: data.tables,
        links: data.links,
        warnings: data.warnings,
      });
    });
    return job.id;
  },
};
declare global {
  interface Window {
    hashira: typeof api;
    __selection?: unknown;
  }
}
window.hashira = api;
