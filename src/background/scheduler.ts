import { appendFlatRecordSemantics } from '../engines/semantics';
import { applyCooldown } from './cooldown';
import { db, log } from '../storage/db';
import type { Job, PageTask, ResourceTask, Detection, ExtractedRecord } from '../types';
import { analyze, hasOrigin, waitForTab } from './browser';
import { canonical, inScope, redact } from '../security/policy';
import { hashText, errorText, uid } from '../utils/core';
import { robotsAllows, retryDelay, retryAfter } from '../engines/crawler/policy';
import { readBounded } from '../engines/images/verify';
import { fetchResource, saveResource, reconcileDownloads } from './downloads';
import { recover } from '../engines/resume';
import { recordId, normalizeFields, completeness } from '../engines/normalization';
export const owner = uid();
let pumping = false;
let initialized = false;
async function robots(job: Job) {
  if (job.robots) return job;
  const response = await fetch(job.origin + '/robots.txt', {
    credentials: 'include',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 429) {
    await applyCooldown(job.id, retryAfter(response.headers.get('retry-after')));
    return;
  }
  if (response.status !== 404 && !response.ok)
    throw new Error(`robots.txt returned HTTP ${response.status}. Check access before resuming.`);
  const text = response.status === 404 ? '' : (await response.text()).slice(0, 500000);
  job.robots = { text, status: response.status };
  await db.jobs.update(job.id, { robots: job.robots });
  return job;
}
function branchForTask(task: PageTask, job: Job, pages: PageTask[]): string | undefined {
  if (!job.config.branches.length) return undefined;
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const visited = new Set<string>();
  let current: PageTask | undefined = task;
  while (current && visited.size < 100 && !visited.has(current.url)) {
    visited.add(current.url);
    if (current.branchId && job.config.branches.includes(current.branchId)) return current.branchId;
    const match = job.config.branches.find((branch) =>
      inScope(current!.url, job.origin, { ...job.config, branches: [branch] }),
    );
    if (match) return match;
    current = byUrl.get(current.parentUrl);
  }
  return undefined;
}
export async function checkpoint(task: PageTask, job: Job, data: Detection) {
  const now = Date.now();
  const duplicate = await db.snapshots
    .where('[jobId+fingerprint]')
    .equals([job.id, data.fingerprint])
    .first();
  const allPages = await db.pages.where('jobId').equals(job.id).toArray();
  const seen = new Set(allPages.map((p) => p.url));
  const tasks: PageTask[] = [];
  const manual = job.mode === 'manual';
  const links = manual ? [] : [...data.links];
  if (!manual && data.next && !links.some((l) => l.url === data.next))
    links.unshift({
      url: data.next,
      text: 'Next',
      parentUrl: task.url,
      kind: 'pagination',
      depth: task.depth + 1,
    });
  const taskBranch = branchForTask(task, job, allPages);
  const branchPath = manual
    ? data.semantic?.categories.find((category) => category.id === task.branchId)?.path
    : data.semantic?.categories
        .filter((c) => c.source === 'breadcrumb')
        .sort((a, b) => b.path.length - a.path.length)[0]?.path;
  for (const link of links) {
    if (
      (job.config.traverse === 'details' && !['detail', 'pagination'].includes(link.kind)) ||
      (job.config.traverse === 'pagination' && link.kind !== 'pagination') ||
      (job.config.traverse === 'categories' &&
        !['category', 'pagination', 'listing'].includes(link.kind))
    )
      continue;
    const url = canonical(link.url);
    const depth = link.kind === 'pagination' ? task.depth : task.depth + 1;
    const inheritedBranch =
      taskBranch && ['detail', 'pagination'].includes(link.kind) ? taskBranch : undefined;
    const linkScope = inheritedBranch ? { ...job.config, branches: [] } : job.config;
    if (
      duplicate ||
      !url ||
      seen.has(url) ||
      seen.size >= job.config.maxPages ||
      depth > job.config.maxDepth ||
      !inScope(url, job.origin, linkScope) ||
      !robotsAllows(job.robots?.text || '', url)
    )
      continue;
    seen.add(url);
    tasks.push({
      id: job.id + ':' + hashText(url),
      jobId: job.id,
      url,
      parentUrl: task.url,
      branchId:
        inheritedBranch ||
        job.config.branches.find((b) => inScope(url, job.origin, { ...job.config, branches: [b] })),
      depth,
      kind: link.kind,
      state: 'PENDING',
      attempts: 0,
      nextAt: now + job.config.delayMs,
    });
  }
  let scheduledCount = 0;
  let wasDuplicate = !!duplicate;
  const records = (job.config.exploreOnly ? [] : data.records).map((r) => ({
    ...r,
    id: job.id + ':' + r.id,
    jobId: job.id,
  }));
  const existingResources = await db.resources.where('jobId').equals(job.id).toArray();
  const byUrl = new Map(existingResources.map((r) => [r.url, r]));
  let remaining = Math.max(
    0,
    job.config.maxImages - existingResources.filter((r) => r.kind === 'image').length,
  );
  const resources: ResourceTask[] = [];
  if (job.config.downloadImages)
    for (const img of data.images) {
      if (job.config.selectedImageUrls && !job.config.selectedImageUrls.includes(img.url)) continue;
      const previous = byUrl.get(img.url);
      if (!previous && remaining-- <= 0) continue;
      const recordIds = img.recordIds.map((id) => job.id + ':' + id);
      const ids = recordIds.length
        ? recordIds
        : records
            .filter((r) => r.imageUrls.some((u) => img.alternatives.includes(u) || u === img.url))
            .map((r) => r.id);
      resources.push(
        previous
          ? { ...previous, recordIds: [...new Set([...previous.recordIds, ...ids])] }
          : {
              id: job.id + ':img:' + hashText(img.url),
              jobId: job.id,
              url: img.url,
              kind: 'image',
              recordIds: ids,
              branchPath,
              state: 'PENDING',
              attempts: 0,
              nextAt: now,
            },
      );
    }
  if (!job.config.exploreOnly && job.config.downloadVideos)
    for (const video of data.videos || []) {
      if (!video.downloadable || byUrl.has(video.url)) continue;
      resources.push({
        id: job.id + ':video:' + hashText(video.url),
        jobId: job.id,
        url: video.url,
        kind: 'video',
        recordIds: [],
        branchPath,
        state: 'PENDING',
        attempts: 0,
        nextAt: now,
      });
    }
  if (!manual && job.config.downloadDocuments)
    for (const link of data.links.filter(
      (l) => l.kind === 'document' && /\.pdf(?:\?|$)/i.test(l.url),
    )) {
      if (
        new URL(link.url).origin !== job.origin ||
        !robotsAllows(job.robots?.text || '', link.url) ||
        byUrl.has(link.url)
      )
        continue;
      resources.push({
        id: job.id + ':doc:' + hashText(link.url),
        jobId: job.id,
        url: link.url,
        kind: 'document',
        recordIds: records.map((r) => r.id),
        state: 'PENDING',
        attempts: 0,
        nextAt: now,
      });
    }
  await db.transaction(
    'rw',
    [db.pages, db.records, db.snapshots, db.resources, db.jobs, db.profiles],
    async () => {
      if (manual) {
        const current = await db.jobs.get(job.id);
        if (current?.state === 'CANCELLED') throw new Error('Start a new capture session');
        if (!current) {
          if (job.checkpoint) throw new Error('Capture session no longer exists');
          await db.jobs.add(job);
        }
        if (await db.pages.get(task.id)) return;
        if ((await db.pages.where('jobId').equals(job.id).count()) >= job.config.maxPages)
          throw new Error('Capture session reached its page limit');
        await db.pages.add(task);
      }
      wasDuplicate =
        wasDuplicate ||
        !!(await db.snapshots
          .where('[jobId+fingerprint]')
          .equals([job.id, data.fingerprint])
          .first());
      if (records.length)
        for (const record of records) {
          const previous = await db.records.get(record.id);
          await db.records.put(
            previous
              ? {
                  ...record,
                  categoryIds: [
                    ...new Set([...(previous.categoryIds || []), ...(record.categoryIds || [])]),
                  ],
                  fields: {
                    ...previous.fields,
                    ...Object.fromEntries(
                      Object.entries(record.fields).filter(([, v]) => v !== '' && v != null),
                    ),
                  },
                  raw: {
                    ...previous.raw,
                    ...Object.fromEntries(
                      Object.entries(record.raw).filter(([, v]) => v !== '' && v != null),
                    ),
                  },
                  imageUrls: [...new Set([...previous.imageUrls, ...record.imageUrls])],
                }
              : record,
          );
        }
      await db.snapshots.put({
        id: task.id,
        jobId: job.id,
        url: data.url,
        title: data.title,
        at: now,
        fingerprint: data.fingerprint,
        html: data.html,
        text: data.text,
        metadata: data.metadata,
        videos: data.videos,
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
        links: data.links.map((l) => ({ ...l, depth: task.depth + 1 })),
        warnings: data.warnings,
      });
      if (tasks.length && !wasDuplicate) {
        const fresh = await db.pages.where('jobId').equals(job.id).toArray();
        const freshIds = new Set(fresh.map((p) => p.id));
        const bounded = tasks
          .filter((p) => !freshIds.has(p.id))
          .slice(0, Math.max(0, job.config.maxPages - fresh.length));
        scheduledCount = bounded.length;
        if (bounded.length) await db.pages.bulkPut(bounded);
      }
      const freshResources = await db.resources.where('jobId').equals(job.id).toArray();
      let imageSlots = Math.max(
        0,
        job.config.maxImages - freshResources.filter((r) => r.kind === 'image').length,
      );
      let videoSlots = Math.max(
        0,
        (job.config.maxVideos ?? 100) - freshResources.filter((r) => r.kind === 'video').length,
      );
      if (resources.length)
        for (const resource of resources) {
          const current = await db.resources.get(resource.id);
          if (!current && resource.kind === 'video' && videoSlots-- <= 0) continue;
          if (!current && resource.kind === 'image' && imageSlots-- <= 0) continue;
          await db.resources.put(
            current
              ? {
                  ...current,
                  recordIds: [...new Set([...current.recordIds, ...resource.recordIds])],
                }
              : resource,
          );
        }
      await db.pages.update(task.id, {
        state: 'DONE',
        fingerprint: data.fingerprint,
        tabId: undefined,
        leaseUntil: undefined,
        owner: undefined,
        error: undefined,
      });
      const current = await db.jobs.get(job.id);
      if (current)
        await db.jobs.update(job.id, {
          checkpoint: current.checkpoint + 1,
          updatedAt: now,
          ...(manual && ['CREATED', 'FAILED', 'COMPLETED'].includes(current.state)
            ? { state: 'RUNNING', lastError: undefined }
            : {}),
        });
      for (const result of data.profileResults ||
        (data.profileId
          ? [{ id: data.profileId, valid: !!data.profileValid, count: records.length }]
          : [])) {
        const p = await db.profiles.get(result.id);
        if (p) {
          const valid = result.valid;
          await db.profiles.update(p.id, {
            successes: p.successes + Number(valid),
            failures: p.failures + Number(!valid),
            confidence: (p.successes + Number(valid) + 1) / (p.successes + p.failures + 3),
            updatedAt: now,
            history: [...p.history, { at: now, count: result.count, valid }].slice(-50),
          });
        }
      }
    },
  );
  await log(
    job.id,
    'info',
    'CHECKPOINT',
    `${data.title}: ${records.length} records; ${scheduledCount} new pages${wasDuplicate ? '; repeated fingerprint stopped discovery' : ''}`,
    task.url,
  );
}
async function collectApis(data: Detection, job: Job) {
  for (const path of job.config.apiPaths) {
    const url = job.origin + path;
    if (!robotsAllows(job.robots?.text || '', url)) {
      data.warnings.push('API path blocked by robots.txt: ' + path);
      continue;
    }
    try {
      const response = await fetch(url, {
        credentials: 'include',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 429) {
        await applyCooldown(job.id, retryAfter(response.headers.get('retry-after')), {
          pageLimit: 1,
          downloadLimit: 1,
        });
        data.warnings.push('API ' + path + ': HTTP 429; cooldown applied');
        break;
      }
      if (!response.ok) throw new Error('HTTP ' + response.status);
      if (!response.headers.get('content-type')?.includes('json'))
        throw new Error('Not a JSON response');
      const text = await (await readBounded(response, 2_000_000)).text();
      if (text.length > 2_000_000) throw new Error('API response exceeds 2 MB limit');
      const json = redact(JSON.parse(text));
      data.embedded.push({ api: url, data: json });
      const arrays = Array.isArray(json)
        ? [json]
        : json && typeof json === 'object'
          ? Object.values(json).filter(Array.isArray)
          : [];
      for (const arr of arrays)
        for (const item of arr.slice(0, 1000)) {
          if (!item || typeof item !== 'object') continue;
          const raw = Object.fromEntries(
            Object.entries(item).filter(
              ([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v),
            ),
          );
          const fields = normalizeFields(raw);
          const record: ExtractedRecord = {
            id: recordId(url, 'api', raw),
            group: 'API ' + path,
            raw,
            fields,
            sourceUrl: url,
            imageUrls: [],
            confidence: 0.8,
            completeness: completeness(fields),
          };
          data.records.push(record);
          appendFlatRecordSemantics(data.semantic, record);
        }
    } catch (e) {
      data.warnings.push('API ' + path + ': ' + errorText(e));
    }
  }
}
async function processPage(task: PageTask, job: Job) {
  await db.pages.update(task.id, {
    state: 'LEASED',
    owner,
    leaseUntil: Date.now() + job.config.timeoutMs + 10000,
  });
  let tabId: number | undefined;
  try {
    if (
      job.config.branches.length &&
      canonical(task.url) !== job.startUrl &&
      !branchForTask(task, job, await db.pages.where('jobId').equals(job.id).toArray())
    ) {
      await db.pages.update(task.id, {
        state: 'BLOCKED',
        error: 'Queued URL is outside the selected branches; retained for review.',
      });
      return;
    }
    if (!(await hasOrigin(job.origin)))
      throw new Error('Site permission is missing. Grant access and resume.');
    if (!robotsAllows(job.robots?.text || '', task.url)) {
      await db.pages.update(task.id, { state: 'BLOCKED', error: 'Disallowed by robots.txt' });
      return;
    }
    const tab = await chrome.tabs.create({ url: task.url, active: false });
    tabId = tab.id;
    if (tabId === undefined) throw new Error('Chrome did not create a scraping tab');
    await db.pages.update(task.id, { tabId });
    await waitForTab(tabId, job.config.timeoutMs);
    const actual = await chrome.tabs.get(tabId);
    if (!actual.url || new URL(actual.url).origin !== job.origin)
      throw new Error('Unexpected cross-origin navigation; login or redirect may be required.');
    if (!inScope(actual.url, job.origin, { ...job.config, branches: [] }))
      throw new Error('Unexpected navigation outside configured URL filters.');
    const data = await analyze(tabId, job.config);
    if (new URL(data.url).origin !== job.origin)
      throw new Error('Unexpected cross-origin navigation during analysis');
    if (!inScope(data.url, job.origin, { ...job.config, branches: [] }))
      throw new Error('Unexpected navigation outside configured URL filters during analysis');
    if (data.authWall || data.status === 401 || data.status === 403) {
      await db.jobs.update(job.id, {
        state: 'PAUSED',
        lastError:
          'Authentication or access wall. Log in manually in this Chrome profile, then Resume.',
      });
      await db.pages.update(task.id, { state: 'BLOCKED', error: 'Authentication or access wall' });
      return;
    }
    if (data.status === 429) {
      await applyCooldown(job.id, 60000, {
        pageLimit: Math.max(1, Math.floor((job.pageLimit || job.config.pageConcurrency) / 2)),
        downloadLimit: 1,
      });
      throw new Error('HTTP 429: waiting 60 seconds');
    }
    if (data.status && data.status >= 400) throw new Error('HTTP ' + data.status);
    await collectApis(data, job);
    await checkpoint(task, job, data);
  } catch (e) {
    const message = errorText(e);
    const attempts = task.attempts + 1;
    const permanent = /HTTP (400|404|410)/.test(message);
    const boundary = /permission|cross-origin|robots.txt|outside configured/.test(message);
    await db.pages.update(task.id, {
      state: boundary
        ? 'BLOCKED'
        : permanent || attempts > job.config.retries
          ? 'FAILED'
          : 'PENDING',
      attempts,
      nextAt: Date.now() + retryDelay(attempts),
      error: message,
    });
    if (boundary) await db.jobs.update(job.id, { state: 'PAUSED', lastError: message });
    await log(job.id, 'error', 'PAGE', message, task.url);
  } finally {
    if (tabId !== undefined) {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        /* user may have closed it */
      }
    }
    await db.pages.update(task.id, { tabId: undefined, owner: undefined, leaseUntil: undefined });
  }
}
export async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    if (!initialized) {
      await recover(owner);
      initialized = true;
    }
    await reconcileDownloads();
    const jobs = await db.jobs.where('state').equals('RUNNING').toArray();
    for (let job of jobs) {
      const fresh = await db.jobs.get(job.id);
      if (!fresh || fresh.state !== 'RUNNING') continue;
      job = fresh;
      if (job.blockedUntil > Date.now()) continue;
      const storage = await navigator.storage.estimate();
      if (storage.quota && storage.usage && storage.usage > storage.quota * 0.9) {
        await db.jobs.update(job.id, {
          state: 'PAUSED',
          lastError:
            'Local storage is above 90% of its quota. Export and remove older jobs before resuming.',
        });
        continue;
      }
      const localOnly =
        job.mode === 'manual' &&
        (await db.resources
          .where('jobId')
          .equals(job.id)
          .filter(
            (resource) =>
              ['PENDING', 'FETCHED'].includes(resource.state) &&
              (resource.state === 'FETCHED' || resource.url.startsWith('data:')) &&
              resource.nextAt <= Date.now(),
          )
          .first());
      const needsRobots =
        job.mode !== 'manual' ||
        (!localOnly &&
          (await db.resources
            .where('jobId')
            .equals(job.id)
            .filter(
              (resource) =>
                resource.state === 'PENDING' && resource.url.startsWith(job.origin + '/'),
            )
            .first()));
      if (needsRobots) {
        try {
          const checked = await robots(job);
          if (!checked) continue;
          job = checked;
        } catch (e) {
          await db.jobs.update(job.id, { state: 'PAUSED', lastError: errorText(e) });
          await log(job.id, 'error', 'ROBOTS', errorText(e));
          continue;
        }
      }
      const pending = await db.pages
        .where('[jobId+state]')
        .equals([job.id, 'PENDING'])
        .filter((p) => p.nextAt <= Date.now())
        .limit(Math.min(job.config.pageConcurrency, job.pageLimit || job.config.pageConcurrency))
        .toArray();
      if (pending.length)
        await db.jobs.update(job.id, { blockedUntil: Date.now() + job.config.delayMs });
      const pageResults = await Promise.allSettled(pending.map((p) => processPage(p, job)));
      for (const r of pageResults)
        if (r.status === 'rejected')
          await log(job.id, 'error', 'PAGE_TRANSACTION', errorText(r.reason));
      const afterPages = await db.jobs.get(job.id);
      if (afterPages?.state !== 'RUNNING' || (afterPages.cooldownUntil || 0) > Date.now()) continue;
      job = { ...job, pageLimit: afterPages.pageLimit, downloadLimit: afterPages.downloadLimit };
      const savingCount = await db.resources
        .where('jobId')
        .equals(job.id)
        .filter((r) => ['SAVING', 'FETCHING'].includes(r.state))
        .count();
      const downloads = await db.resources
        .where('jobId')
        .equals(job.id)
        .filter(
          (r) =>
            (r.state === 'PENDING' || r.state === 'FETCHED') &&
            r.nextAt <= Date.now() &&
            (!localOnly || r.state === 'FETCHED' || r.url.startsWith('data:')) &&
            (job.mode !== 'manual' ||
              r.state === 'FETCHED' ||
              !r.url.startsWith(job.origin + '/') ||
              !!job.robots),
        )
        .limit(
          Math.min(
            Math.max(0, job.config.downloadConcurrency - savingCount),
            Math.max(0, (job.downloadLimit || job.config.downloadConcurrency) - savingCount),
            Math.max(
              0,
              Math.max(1, Math.floor(job.config.memoryMB / (job.config.maxResourceMB * 2))) -
                savingCount,
            ),
          ),
        )
        .toArray();
      const downloadResults = await Promise.allSettled(
        downloads.map((r) =>
          r.state === 'FETCHED' ? saveResource(r, job) : fetchResource(r, job, owner),
        ),
      );
      for (const r of downloadResults)
        if (r.status === 'rejected')
          await log(job.id, 'error', 'DOWNLOAD_TRANSACTION', errorText(r.reason));
      const finishingCheckpoint = (await db.jobs.get(job.id))?.checkpoint;
      const pages = await db.pages.where('jobId').equals(job.id).toArray();
      const resources = await db.resources.where('jobId').equals(job.id).toArray();
      const activePages = pages.some((p) => p.state === 'PENDING' || p.state === 'LEASED');
      const activeResources = resources.some((r) =>
        ['PENDING', 'FETCHING', 'FETCHED', 'SAVING'].includes(r.state),
      );
      if (!activePages && !activeResources && (await db.jobs.get(job.id))?.state === 'RUNNING') {
        const failures =
          pages.filter((p) => p.state === 'FAILED' || p.state === 'BLOCKED').length +
          resources.filter((r) => r.state === 'FAILED' || r.state === 'BLOCKED').length;
        await db.transaction('rw', db.jobs, async () => {
          const current = await db.jobs.get(job.id);
          if (current?.state !== 'RUNNING' || current.checkpoint !== finishingCheckpoint) return;
          await db.jobs.update(job.id, {
            state: failures ? 'FAILED' : 'COMPLETED',
            lastError: failures
              ? `${failures} operation(s) need attention. Completed data is preserved and can be exported.`
              : undefined,
            updatedAt: Date.now(),
          });
        });
        await log(
          job.id,
          failures ? 'warning' : 'info',
          'FINISHED',
          failures ? 'Finished with failures' : 'Completed',
        );
      }
    }
  } catch (e) {
    await log('system', 'error', 'SCHEDULER', errorText(e)).catch(() => undefined);
  } finally {
    pumping = false;
  }
}
