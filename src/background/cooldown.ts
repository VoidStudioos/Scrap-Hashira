import { db } from '../storage/db';
export async function applyCooldown(
  jobId: string,
  delay: number,
  limits: { pageLimit?: number; downloadLimit?: number } = {},
) {
  await db.transaction('rw', db.jobs, async () => {
    const job = await db.jobs.get(jobId);
    if (!job) return;
    const until = Date.now() + Math.max(1000, delay);
    await db.jobs.update(jobId, {
      ...limits,
      blockedUntil: Math.max(job.blockedUntil, until),
      cooldownUntil: Math.max(job.cooldownUntil || 0, until),
    });
  });
}
