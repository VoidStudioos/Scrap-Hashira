import { db } from '../storage/db';
export async function assertExportReady(jobId: string) {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error('Job not found');
  const pageActive = await db.pages.where('[jobId+state]').equals([jobId, 'LEASED']).count();
  const resourceActive = await db.resources
    .where('jobId')
    .equals(jobId)
    .filter((r) => r.state === 'FETCHING')
    .count();
  if (job.state === 'RUNNING' || pageActive || resourceActive)
    throw new Error(
      'Pause the job and wait for active page/fetch checkpoints before exporting a consistent dataset.',
    );
  return job;
}
