import { describe, it, expect } from 'vitest';
import { StorageService } from '../../src/storage/storageService';
import { ResumeEngine } from '../../src/engines/resume/resumeEngine';
import { db } from '../../src/storage/db';

describe('Crash-Proof Resume Engine', () => {
  it('creates checkpoints and restores interrupted jobs correctly', async () => {
    // 1. Create a job
    const job = await StorageService.createJob('https://example.com/shop', 'Resume Test Job');
    expect(job.state).toBe('CREATED');

    // 2. Add queue items
    await StorageService.enqueueUrl(job.id, 'https://example.com/shop/page2', 1, 'pagination');
    await StorageService.enqueueUrl(job.id, 'https://example.com/shop/page3', 1, 'pagination');

    // 3. Mark job as RUNNING and simulate an interrupted queue item
    await StorageService.updateJobState(job.id, 'RUNNING');
    const firstItem = await StorageService.getNextQueueItem(job.id);
    expect(firstItem).toBeDefined();

    await StorageService.updateQueueStatus(firstItem!.id!, 'processing');

    // 4. Simulate crash recovery
    const recovery = await ResumeEngine.resumeJob(job.id);
    expect(recovery.success).toBe(true);
    // The 'processing' item was reset to 'pending'
    expect(recovery.pendingPages).toBeGreaterThanOrEqual(1);

    // 5. Create durable checkpoint
    const checkpoint = await ResumeEngine.createCheckpoint(job.id);
    expect(checkpoint).toBeDefined();
    expect(checkpoint?.jobId).toBe(job.id);
  });
});
