import { db } from './db';
export async function deleteLocalJob(id: string) {
  const job = await db.jobs.get(id);
  if (!job) throw new Error('Job not found');
  const pages = await db.pages.where('jobId').equals(id).toArray();
  const resources = await db.resources.where('jobId').equals(id).toArray();
  if (
    job.state === 'RUNNING' ||
    pages.some((p) => p.state === 'LEASED') ||
    resources.some((r) => r.state === 'FETCHING' || r.state === 'SAVING')
  )
    throw new Error(
      'Cancel the job and wait for active work to settle before deleting local data.',
    );
  const hashes = [...new Set(resources.flatMap((r) => (r.hash ? [r.hash] : [])))];
  await db.transaction(
    'rw',
    [db.jobs, db.pages, db.records, db.snapshots, db.resources, db.blobs, db.logs],
    async () => {
      for (const table of [db.pages, db.records, db.snapshots, db.resources, db.logs])
        await table.where('jobId').equals(id).delete();
      for (const hash of hashes)
        if (!(await db.resources.where('hash').equals(hash).count())) await db.blobs.delete(hash);
      await db.jobs.delete(id);
    },
  );
}
