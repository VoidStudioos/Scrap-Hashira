import { analyze } from './browser';
import { checkpoint } from './scheduler';
import { assignBranch, branchPath } from '../engines/semantics/branch';
import { canonical, inScope, validateConfig } from '../security/policy';
import { db } from '../storage/db';
import type { CrawlConfig, Job } from '../types';
import { hashText, uid } from '../utils/core';

export async function captureBranch(
  tabId: number,
  expectedUrl: string,
  pathInput: string,
  config: Partial<CrawlConfig>,
  jobId?: string,
) {
  const path = branchPath(pathInput.slice(0, 600));
  if (!path.length || path.length > 15) throw new Error('Enter a branch path (1–15 levels)');
  const start = canonical(expectedUrl);
  if (!start || canonical((await chrome.tabs.get(tabId)).url || '') !== start)
    throw new Error('The selected tab changed. Select its current page and try again.');
  const origin = new URL(start).origin;
  const previous = jobId ? await db.jobs.get(jobId) : undefined;
  if (
    jobId &&
    (!previous ||
      previous.mode !== 'manual' ||
      previous.origin !== origin ||
      previous.state === 'CANCELLED')
  )
    throw new Error('Start a new capture session for this site.');
  const now = Date.now();
  const job: Job = previous || {
    id: uid(),
    name: new URL(start).hostname + ' — branch capture',
    mode: 'manual',
    state: 'CREATED',
    startUrl: start,
    origin,
    config: validateConfig({
      ...config,
      branches: [],
      apiPaths: [],
      exploreOnly: false,
      downloadImages: true,
      selectedImageUrls: undefined,
    }),
    createdAt: now,
    updatedAt: now,
    checkpoint: 0,
    blockedUntil: 0,
  };
  if (!inScope(start, origin, job.config))
    throw new Error('The selected page is outside this job’s scope.');
  const options = validateConfig(config);
  const data = await analyze(tabId, {
    timeoutMs: options.timeoutMs,
    fullCapture: job.config.fullCapture,
    profileIds: options.profileIds,
    profileId: options.profileId,
    candidateIds: options.candidateIds,
    candidateId: options.candidateId,
  });
  if (
    canonical(data.url) !== start ||
    canonical((await chrome.tabs.get(tabId)).url || '') !== start
  )
    throw new Error('The selected tab navigated during capture. Try again on the open branch.');
  if (data.authWall || (data.status && data.status >= 400))
    throw new Error('This page requires access or returned an HTTP error. Check it in Chrome.');
  const branch = assignBranch(data, origin, path);
  data.images = data.images
    .filter(
      (image) => image.recordIds.length || !['logo', 'icon', 'decorative'].includes(image.role),
    )
    .sort(
      (a, b) =>
        Number(!!b.recordIds.length) - Number(!!a.recordIds.length) || b.confidence - a.confidence,
    );
  if (!data.records.length && !data.tables.length && !data.images.length)
    throw new Error('No records, tables or content images found in this branch.');
  const id = job.id + ':live:' + hashText(JSON.stringify([start, branch.id, data.fingerprint]));
  await checkpoint(
    {
      id,
      jobId: job.id,
      branchId: branch.id,
      url: start,
      parentUrl: '',
      depth: path.length - 1,
      kind: 'category',
      state: 'DONE',
      attempts: 0,
      nextAt: 0,
    },
    job,
    data,
  );
  return {
    jobId: job.id,
    records: data.records.length,
    images: data.images.length,
    warnings: data.warnings.slice(0, 3),
  };
}
