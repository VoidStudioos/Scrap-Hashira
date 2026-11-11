import { beforeAll, beforeEach, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { db } from '../../src/storage/db';
import { DEFAULT_CONFIG, type Detection, type Job } from '../../src/types';
const browser = vi.hoisted(() => ({
  analyze: vi.fn(),
  hasOrigin: vi.fn(async () => true),
  waitForTab: vi.fn(async () => undefined),
  offscreenCall: vi.fn(async (op: string) =>
    op === 'URL' ? 'blob:fixture' : { width: 640, height: 480 },
  ),
}));
vi.mock('../../src/background/browser', () => browser);
import { pump } from '../../src/background/scheduler';
import { recover, setJobState } from '../../src/engines/resume';
import { fetchResource } from '../../src/background/downloads';
let now = Date.now();
const items = new Map<number, chrome.downloads.DownloadItem>();
let nextId = 0;
beforeAll(() => {
  Object.defineProperty(navigator, 'storage', {
    value: { estimate: async () => ({ quota: 10_000_000, usage: 1000 }) },
    configurable: true,
  });
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: webcrypto.subtle,
    configurable: true,
  });
  vi.stubGlobal('chrome', {
    tabs: {
      create: vi.fn(async ({ url }: { url: string }) => ({ id: 1, url })),
      remove: vi.fn(async () => undefined),
      get: vi.fn(async () => ({ url: 'https://test.site/start' })),
    },
    downloads: {
      download: vi.fn(async ({ filename, url }: { filename: string; url: string }) => {
        const id = ++nextId;
        items.set(id, {
          id,
          state: 'complete',
          exists: true,
          filename,
          url,
        } as chrome.downloads.DownloadItem);
        return id;
      }),
      search: vi.fn(async ({ id, url }: { id?: number; url?: string }) =>
        [...items.values()].filter((i) => (id !== undefined ? i.id === id : i.url === url)),
      ),
      pause: vi.fn(async () => undefined),
      resume: vi.fn(async () => undefined),
      cancel: vi.fn(async () => undefined),
    },
  });
});
beforeEach(async () => {
  now += 60000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  items.clear();
  browser.hasOrigin.mockResolvedValue(true);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('User-agent: *\nDisallow: /private', { status: 200 })),
  );
});
const job = (): Job => ({
  id: 'j',
  name: 'fixture',
  origin: 'https://test.site',
  startUrl: 'https://test.site/start',
  state: 'RUNNING',
  config: {
    ...DEFAULT_CONFIG,
    maxPages: 2,
    maxImages: 0,
    delayMs: 250,
    downloadImages: false,
    include: ['https://test.site/*'],
  },
  createdAt: now,
  updatedAt: now,
  checkpoint: 0,
  blockedUntil: 0,
});
const detection = (): Detection => ({
  url: 'https://test.site/start',
  title: 'Fixture',
  records: [
    {
      id: 'r1',
      group: 'test',
      raw: { name: 'لنت' },
      fields: { name: 'لنت' },
      sourceUrl: 'https://test.site/start',
      imageUrls: [],
      confidence: 0.9,
      completeness: 100,
    },
  ],
  images: [],
  tables: [],
  links: [
    {
      url: 'https://test.site/next',
      text: 'Next',
      kind: 'pagination',
      depth: 1,
      parentUrl: 'https://test.site/start',
    },
    {
      url: 'https://other.site/a',
      text: 'External',
      kind: 'page',
      depth: 1,
      parentUrl: 'https://test.site/start',
    },
  ],
  candidates: [],
  structured: [],
  embedded: [],
  metadata: {},
  fingerprint: 'same-page',
  adapter: 'Generic DOM',
  authWall: false,
  warnings: [],
});
async function seed() {
  await db.jobs.put(job());
  await db.pages.put({
    id: 'p',
    jobId: 'j',
    url: 'https://test.site/start',
    parentUrl: '',
    kind: 'page',
    depth: 0,
    state: 'PENDING',
    attempts: 0,
    nextAt: 0,
  });
}
it('checkpoints atomically, deduplicates content and completes a bounded job', async () => {
  await seed();
  browser.analyze.mockResolvedValue(detection());
  await pump();
  expect(await db.records.count()).toBe(1);
  expect(await db.pages.count()).toBe(2);
  expect((await db.jobs.get('j'))?.checkpoint).toBe(1);
  now += 1000;
  await pump();
  expect(await db.records.count()).toBe(1);
  expect((await db.jobs.get('j'))?.state).toBe('COMPLETED');
  expect(await db.pages.filter((p) => new URL(p.url).origin !== 'https://test.site').count()).toBe(
    0,
  );
});
it('reclaims a terminated worker lease without deleting completed records', async () => {
  await seed();
  await db.records.put(detection().records[0]!);
  await db.pages.update('p', {
    state: 'LEASED',
    owner: 'dead-worker',
    leaseUntil: now + 60000,
    tabId: 77,
  });
  await recover('new-worker');
  expect((await db.pages.get('p'))?.state).toBe('PENDING');
  expect(await db.records.count()).toBe(1);
  expect(chrome.tabs.remove).toHaveBeenCalledWith(77);
});
it('marks running browser-restart jobs interrupted until the user resumes', async () => {
  await seed();
  await recover('new-boot', true);
  expect((await db.jobs.get('j'))?.state).toBe('INTERRUPTED');
  await setJobState('j', 'RUNNING');
  expect((await db.jobs.get('j'))?.state).toBe('RUNNING');
});
it('pauses for authentication walls and preserves the URL for resume', async () => {
  await seed();
  browser.analyze.mockResolvedValue({ ...detection(), authWall: true });
  await pump();
  expect((await db.jobs.get('j'))?.state).toBe('PAUSED');
  expect((await db.pages.get('p'))?.state).toBe('BLOCKED');
  expect(await db.snapshots.count()).toBe(0);
});
it('does not visit robots-disallowed URLs', async () => {
  await seed();
  await db.pages.update('p', { url: 'https://test.site/private' });
  browser.analyze.mockClear();
  await pump();
  expect(browser.analyze).not.toHaveBeenCalled();
  expect((await db.pages.get('p'))?.state).toBe('BLOCKED');
});
it('bounds permanent page errors and keeps actionable diagnostics', async () => {
  await seed();
  browser.analyze.mockResolvedValue({ ...detection(), status: 404 });
  await pump();
  expect((await db.pages.get('p'))?.state).toBe('FAILED');
  expect((await db.jobs.get('j'))?.state).toBe('FAILED');
  expect(
    (await db.logs.where('jobId').equals('j').toArray()).some((l) => l.message === 'HTTP 404'),
  ).toBe(true);
});
it('reports 429 cooldowns without retrying indefinitely or rotating origins', async () => {
  await seed();
  const j = job();
  j.config.downloadImages = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('Slow down', { status: 429, headers: { 'Retry-After': '90' } })),
  );
  const task = {
    id: 'image',
    jobId: j.id,
    url: j.origin + '/x.png',
    kind: 'image' as const,
    recordIds: [],
    state: 'PENDING' as const,
    attempts: 0,
    nextAt: 0,
  };
  await db.resources.put(task);
  await fetchResource(task, j, 'worker');
  expect((await db.jobs.get('j'))?.blockedUntil).toBe(now + 90000);
  expect((await db.resources.get('image'))?.attempts).toBe(1);
  expect((await db.resources.get('image'))?.state).toBe('PENDING');
});
it('blocks unapproved external resource hosts without fetching', async () => {
  await seed();
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const task = {
    id: 'cdn',
    jobId: 'j',
    url: 'https://cdn.other.site/x.png',
    kind: 'image' as const,
    recordIds: [],
    state: 'PENDING' as const,
    attempts: 0,
    nextAt: 0,
  };
  await db.resources.put(task);
  await fetchResource(task, job(), 'worker');
  expect(fetcher).not.toHaveBeenCalled();
  expect((await db.resources.get('cdn'))?.state).toBe('BLOCKED');
});
it('keeps page count bounded when two pages commit concurrently', async () => {
  await seed();
  const j = job();
  j.config = { ...j.config, maxPages: 3, pageConcurrency: 2 };
  await db.jobs.put(j);
  await db.pages.put({
    id: 'p2',
    jobId: 'j',
    url: j.origin + '/other',
    parentUrl: '',
    kind: 'page',
    depth: 0,
    state: 'PENDING',
    attempts: 0,
    nextAt: 0,
  });
  let counter = 0;
  browser.analyze.mockImplementation(async () => {
    const n = ++counter;
    return {
      ...detection(),
      fingerprint: 'fp' + n,
      links: [
        { url: j.origin + '/a' + n, text: 'child', kind: 'page', depth: 1, parentUrl: j.startUrl },
      ],
    };
  });
  await pump();
  expect(await db.pages.where('jobId').equals('j').count()).toBe(3);
});
it('follows detail URLs from a selected category without opening sibling categories', async () => {
  await seed();
  const j = job();
  j.config = { ...j.config, maxPages: 4, maxDepth: 3, branches: [j.origin + '/catalog?id=1'] };
  await db.jobs.put(j);
  await db.pages.update('p', {
    url: j.origin + '/catalog?id=1',
    // Legacy queued task has no branchId; infer provenance from its selected URL.
  });
  browser.analyze.mockResolvedValue({
    ...detection(),
    links: [
      {
        url: j.origin + '/product/123',
        text: 'Part',
        kind: 'detail',
        depth: 1,
        parentUrl: j.origin + '/catalog?id=1',
      },
      {
        url: j.origin + '/catalog?id=2',
        text: 'Other',
        kind: 'category',
        depth: 1,
        parentUrl: j.origin + '/catalog?id=1',
      },
    ],
  });
  await pump();
  const tasks = await db.pages.where('jobId').equals('j').toArray();
  expect(
    tasks.some(
      (p) => p.url === j.origin + '/product/123' && p.branchId === j.origin + '/catalog?id=1',
    ),
  ).toBe(true);
  expect(tasks.some((p) => p.url === j.origin + '/catalog?id=2')).toBe(false);
});
it('counts already-saving files against native download concurrency', async () => {
  await seed();
  await db.pages.update('p', { state: 'DONE' });
  const j = job();
  j.config.downloadConcurrency = 1;
  await db.jobs.put(j);
  items.set(99, {
    id: 99,
    url: 'blob:existing',
    state: 'in_progress',
    exists: true,
    filename: 'existing',
  } as chrome.downloads.DownloadItem);
  await db.resources.bulkPut([
    {
      id: 'saving',
      jobId: 'j',
      url: j.origin + '/a.png',
      kind: 'image',
      recordIds: [],
      state: 'SAVING',
      attempts: 0,
      nextAt: 0,
      downloadId: 99,
    },
    {
      id: 'queued',
      jobId: 'j',
      url: j.origin + '/b.png',
      kind: 'image',
      recordIds: [],
      state: 'PENDING',
      attempts: 0,
      nextAt: 0,
    },
  ]);
  const fetcher = vi.fn(async () => new Response('robots'));
  vi.stubGlobal('fetch', fetcher);
  await db.jobs.update('j', { robots: { text: '', status: 404 } });
  await pump();
  expect((await db.resources.get('queued'))?.state).toBe('PENDING');
  expect(fetcher).not.toHaveBeenCalled();
});
it('does not overwrite a user pause when in-flight page work finishes', async () => {
  await seed();
  browser.analyze.mockImplementation(async () => {
    await setJobState('j', 'PAUSED');
    return { ...detection(), links: [] };
  });
  await pump();
  expect((await db.jobs.get('j'))?.state).toBe('PAUSED');
  expect((await db.pages.get('p'))?.state).toBe('DONE');
});
it('honors API Retry-After before starting queued image work', async () => {
  await seed();
  const j = job();
  j.config.apiPaths = ['/api/items'];
  j.config.downloadImages = true;
  j.config.maxImages = 1;
  await db.jobs.put(j);
  browser.analyze.mockResolvedValue({
    ...detection(),
    links: [],
    images: [
      {
        url: j.origin + '/image.png',
        sources: ['img'],
        width: 0,
        height: 0,
        role: 'product',
        confidence: 0.8,
        recordIds: ['r1'],
        alternatives: [],
      },
    ],
  });
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith('/robots.txt')
      ? new Response('User-agent: *')
      : new Response('slow', { status: 429, headers: { 'Retry-After': '90' } }),
  );
  vi.stubGlobal('fetch', fetcher);
  await pump();
  expect((await db.jobs.get('j'))?.cooldownUntil).toBe(now + 90000);
  expect((await db.resources.toArray())[0]?.state).toBe('PENDING');
  expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/image.png'))).toBe(false);
});
it('never shortens an existing server cooldown', async () => {
  await seed();
  const { applyCooldown } = await import('../../src/background/cooldown');
  await applyCooldown('j', 90000);
  await applyCooldown('j', 1000);
  expect((await db.jobs.get('j'))?.blockedUntil).toBe(now + 90000);
  expect((await db.jobs.get('j'))?.cooldownUntil).toBe(now + 90000);
});
it('blocks exports during a running or partly checkpointed job', async () => {
  await seed();
  const { assertExportReady } = await import('../../src/exports/guard');
  await expect(assertExportReady('j')).rejects.toThrow('Pause');
  await db.jobs.update('j', { state: 'PAUSED' });
  await db.pages.update('p', { state: 'LEASED' });
  await expect(assertExportReady('j')).rejects.toThrow('Pause');
  await db.pages.update('p', { state: 'DONE' });
  expect((await assertExportReady('j')).id).toBe('j');
});
it('classifies JSON API records into category exports while preserving identifier strings', async () => {
  await seed();
  const j = job();
  j.config.apiPaths = ['/api/parts'];
  await db.jobs.put(j);
  browser.analyze.mockResolvedValue({
    ...detection(),
    links: [],
    semantic: {
      categories: [
        {
          id: 'cat',
          label: 'Parts',
          path: ['Parts'],
          source: 'page',
          sourceUrl: j.startUrl,
          confidence: 0.5,
        },
      ],
      fields: [],
      imageLinks: [],
      warnings: [],
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith('/robots.txt')
        ? new Response('User-agent: *')
        : new Response(
            JSON.stringify({ items: [{ sku: '00012', price: '850000' }], token: 'secret' }),
            { headers: { 'Content-Type': 'application/json' } },
          ),
    ),
  );
  await pump();
  const snapshot = (await db.snapshots.toArray())[0]!;
  expect(
    snapshot.semantic?.fields.some(
      (f) => f.kind === 'code' && f.raw === '00012' && f.categoryId === 'cat',
    ),
  ).toBe(true);
  const api = (await db.records.toArray()).find((r) => r.group.startsWith('API'))!;
  expect(api.categoryIds).toEqual(['cat']);
  expect(JSON.stringify(snapshot.embedded)).not.toContain('secret');
});
it('deletes only the selected job and retains shared image bytes for other jobs', async () => {
  await seed();
  await db.jobs.update('j', { state: 'CANCELLED' });
  await db.jobs.put({ ...job(), id: 'other', state: 'CANCELLED' });
  await db.blobs.put({ hash: 'shared', blob: new Blob(['bytes']), mime: 'image/png', size: 5 });
  await db.resources.bulkPut([
    {
      id: 'one',
      jobId: 'j',
      url: 'https://test.site/a',
      kind: 'image',
      recordIds: [],
      state: 'FETCHED',
      attempts: 0,
      nextAt: 0,
      hash: 'shared',
    },
    {
      id: 'two',
      jobId: 'other',
      url: 'https://test.site/a',
      kind: 'image',
      recordIds: [],
      state: 'FETCHED',
      attempts: 0,
      nextAt: 0,
      hash: 'shared',
    },
  ]);
  const { deleteLocalJob } = await import('../../src/storage/jobs');
  await deleteLocalJob('j');
  expect(await db.jobs.get('j')).toBeUndefined();
  expect(await db.jobs.get('other')).toBeTruthy();
  expect(await db.blobs.get('shared')).toBeTruthy();
  await deleteLocalJob('other');
  expect(await db.blobs.get('shared')).toBeUndefined();
});

it('blocks a legacy queued sibling category outside a selected query branch', async () => {
  await seed();
  const j = job();
  j.config.branches = [j.origin + '/catalog?id=1'];
  await db.jobs.put(j);
  await db.pages.update('p', { url: j.origin + '/catalog?id=2' });
  browser.analyze.mockClear();
  await pump();
  expect((await db.pages.get('p'))?.state).toBe('BLOCKED');
  expect(browser.analyze).not.toHaveBeenCalled();
});

it('checkpoints two open branches at one URL and downloads a mislabeled inline GIF', async () => {
  const { captureBranch } = await import('../../src/background/capture');
  const { detect } = await import('../../src/engines/detection');
  const url = 'https://test.site/start';
  const gif = 'data:image/jpg;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const gifBytes = Uint8Array.from(atob(gif.split(',')[1]!), (c) => c.charCodeAt(0));
  const fetchAsset = vi.fn(async (source: string) => {
    if (source !== gif) throw new Error('unexpected network request');
    return new Response(gifBytes, { headers: { 'Content-Type': 'image/jpg' } });
  });
  vi.stubGlobal('fetch', fetchAsset);
  const tabCount = vi.mocked(chrome.tabs.create).mock.calls.length;
  browser.analyze.mockImplementation(async () => detect(document, url, {}));
  const render = (vehicle: string) => {
    document.body.innerHTML =
      '<header><img id="site-logo" src="/logo.png"></header><ul>' +
      '<li><div><img id="imgEgrp2" src="' +
      gif +
      '"><span>۰۱- ' +
      vehicle +
      '</span></div></li>' +
      '<li><div><img src="' +
      gif +
      '"><span>۰۲- موتور</span></div></li></ul>';
  };
  render('دنا');
  const first = await captureBranch(42, url, 'خودرو / دنا', DEFAULT_CONFIG);
  await pump();
  expect((await db.jobs.get(first.jobId))?.state).toBe('COMPLETED');
  render('رانا');
  await captureBranch(42, url, 'خودرو / رانا', DEFAULT_CONFIG, first.jobId);
  await captureBranch(42, url, 'خودرو / رانا', DEFAULT_CONFIG, first.jobId);
  await pump();
  const pages = await db.pages.where('jobId').equals(first.jobId).toArray();
  expect(pages.map((p) => p.url)).toEqual([url, url]);
  expect(pages.map((p) => p.branchId)[0]).not.toBe(pages.map((p) => p.branchId)[1]);
  expect(pages.every((p) => p.state === 'DONE')).toBe(true);
  expect(vi.mocked(chrome.tabs.create).mock.calls.length).toBe(tabCount);
  expect(fetchAsset.mock.calls.map(([source]) => source)).toEqual([gif]);
  const assets = await db.resources.where('jobId').equals(first.jobId).toArray();
  expect(assets).toHaveLength(1);
  expect(assets[0]).toMatchObject({ state: 'COMPLETED', mime: 'image/gif' });
  expect(assets[0]?.filename).toMatch(/images\/خودرو_\w+\/دنا_\w+\/.+\.gif$/u);
  expect((await db.blobs.get(assets[0]!.hash!))?.size).toBe(gifBytes.length);
  expect(await db.records.where('jobId').equals(first.jobId).count()).toBe(3);
});
