import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
const origin = 'http://127.0.0.1:4173';
async function harness(page: import('@playwright/test').Page, path: string) {
  await page.goto(origin + path);
  await page.addScriptTag({ url: origin + '/harness.js' });
}
for (const [path, minimum] of [
  ['/custom', 25],
  ['/commerce', 3],
  ['/rtl', 4],
  ['/dynamic', 3],
] as const) {
  test(`detects unfamiliar ${path} through the same engine`, async ({ page }) => {
    await harness(page, path);
    if (path === '/dynamic') await expect(page.locator('.js-card')).toHaveCount(3);
    const result = await page.evaluate(() => {
      const d = window.hashira.detect(document, location.href);
      return {
        count: d.records.length,
        images: d.images.length,
        links: d.links,
        adapter: d.adapter,
        fields: d.records[0]?.fields,
      };
    });
    expect(result.count).toBeGreaterThanOrEqual(minimum);
    expect(result.images).toBeGreaterThan(0);
    expect(result.links.every((l) => new URL(l.url).origin === origin)).toBe(true);
    if (path === '/rtl') expect(result.fields?.price).toBe(850000);
    if (path === '/commerce') expect(result.adapter).toBe('WooCommerce');
  });
}
test('expands JavaScript load-more and scrolling', async ({ page }) => {
  await harness(page, '/dynamic');
  await expect(page.locator('.js-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('.js-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Load more' }).click();
  const d = await page.evaluate(() => window.hashira.detect(document, location.href));
  expect(d.records.length).toBe(9);
});
test('extracts paginated nested tables with merged headers', async ({ page }) => {
  await harness(page, '/tables');
  const first = await page.evaluate(() => window.hashira.detect(document, location.href));
  expect(first.tables).toHaveLength(2);
  expect(first.tables[0]?.headers).toEqual(['کد', 'Stock / Available', 'Stock / Reserved']);
  expect(first.tables[0]?.rows[1]).toEqual(['A1', '20', '3']);
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await page.addScriptTag({ url: origin + '/harness.js' });
  const second = await page.evaluate(() => window.hashira.detect(document, location.href));
  expect(second.tables[0]?.rows[0]?.[0]).toBe('A2');
});
test('visual selector emits a real click selection without following links', async ({ page }) => {
  await harness(page, '/custom');
  await page.evaluate(() => {
    Object.assign(window, {
      chrome: {
        runtime: {
          sendMessage: async (msg: unknown) => {
            window.__selection = msg;
          },
        },
      },
    });
    window.hashira.startSelector('record');
  });
  await page.locator('.unit').first().hover();
  await page.locator('.unit').first().click();
  const data = await page.evaluate(
    () =>
      window.__selection as {
        data: { css: string; repeated: string; count: number; xpath: string };
      },
  );
  expect(data.data.count).toBe(25);
  expect(data.data.xpath).toContain('/section');
  expect(page.url()).toBe(origin + '/custom');
  expect(await page.locator('[data-hashira-overlay]').count()).toBe(0);
});
test('persistent learned selectors survive reload and fall back on drift', async ({ page }) => {
  await harness(page, '/rtl');
  await page.evaluate(async () => {
    await window.hashira.db.profiles.put({
      id: 'rtl',
      name: 'Persian cards',
      origin: location.origin,
      patterns: [location.origin + '/*'],
      pageType: 'list',
      record: { css: '.rtl-card' },
      fields: { name: { css: 'h2' }, price: { css: '.price', transform: 'price' } },
      successes: 1,
      failures: 0,
      confidence: 0.8,
      updatedAt: Date.now(),
      history: [],
    });
  });
  await page.reload();
  await page.addScriptTag({ url: origin + '/harness.js' });
  const result = await page.evaluate(async () => {
    const profiles = await window.hashira.db.profiles.toArray();
    const before = window.hashira.detect(document, location.href, { profiles });
    document.querySelectorAll('.rtl-card').forEach((e) => (e.className = 'changed'));
    const after = window.hashira.detect(document, location.href, { profiles });
    return {
      before: before.profileValid,
      after: after.profileValid,
      records: after.records.length,
    };
  });
  expect(result).toEqual({ before: true, after: false, records: 4 });
});
test('verifies and saves actual image bytes in every supported raster format', async ({ page }) => {
  await harness(page, '/product/001');
  const result = await page.evaluate(async () => {
    const out = [];
    for (const ext of ['jpg', 'png', 'webp', 'avif', 'gif', 'bmp']) {
      const response = await fetch('/assets/photo.' + ext);
      const blob = await window.hashira.readBounded(response, 2_000_000);
      const mime = window.hashira.sniffMime(
        new Uint8Array(await blob.slice(0, 2048).arrayBuffer()),
      );
      const bitmap = await createImageBitmap(blob);
      const hash = await window.hashira.sha256(blob);
      await window.hashira.db.blobs.put({ hash, blob, mime: mime!, size: blob.size });
      out.push({ ext, mime, size: blob.size, width: bitmap.width, height: bitmap.height });
      bitmap.close();
    }
    return out;
  });
  expect(result).toHaveLength(6);
  expect(
    result.every(
      (r) => r.mime?.startsWith('image/') && r.width === 640 && r.height === 480 && r.size > 100,
    ),
  ).toBe(true);
});
test('exports JSON, JSONL, CSV, XLSX and ZIP with real associated image bytes', async ({
  page,
}) => {
  await harness(page, '/rtl');
  await page.evaluate(async () => {
    const h = window.hashira;
    const jobId = await h.seed(location.href);
    const response = await fetch('/assets/photo.png');
    const blob = await response.blob();
    const hash = await h.sha256(blob);
    await h.db.blobs.put({ hash, blob, mime: 'image/png', size: blob.size });
    const record = await h.db.records.where('jobId').equals(jobId).first();
    await h.db.resources.put({
      id: 'fixture-image',
      jobId,
      url: location.origin + '/assets/photo.png',
      kind: 'image',
      recordIds: [record!.id],
      state: 'FETCHED',
      attempts: 0,
      nextAt: 0,
      hash,
      mime: 'image/png',
      size: blob.size,
    });
  });
  const exports = await page.evaluate(async () => {
    const asset = await (await fetch('/extension/sidepanel.js')).text();
    const name = asset.match(/assets\/worker-[\w-]+\.js/)?.[0];
    if (!name) throw new Error('Export worker missing');
    const run = (format: string) =>
      new Promise<{ format: string; bytes: number[] }>((resolve, reject) => {
        const worker = new Worker('/extension/' + name, { type: 'module' });
        worker.onerror = (e) => reject(new Error(e.message));
        worker.onmessage = (e) => {
          if (e.data.type === 'error') {
            worker.terminate();
            reject(new Error(e.data.message));
          }
          if (e.data.type === 'done') {
            const blob = e.data.blob as Blob;
            void blob.arrayBuffer().then((buffer) => {
              worker.terminate();
              resolve({ format, bytes: [...new Uint8Array(buffer)] });
            });
          }
        };
        worker.postMessage({ jobId: 'browser-fixture', format });
      });
    const results = [];
    for (const f of ['json', 'jsonl', 'csv', 'xlsx', 'zip', 'html']) results.push(await run(f));
    return results;
  });
  const find = (f: string) => Buffer.from(exports.find((e) => e.format === f)!.bytes);
  expect(JSON.parse(find('json').toString()).records.length).toBe(4);
  expect(find('jsonl').toString().trim().split('\n')).toHaveLength(4);
  expect(find('csv').toString()).toContain('لنت');
  const wb = XLSX.read(find('xlsx'), { type: 'buffer' });
  expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!)).toHaveLength(4);
  const zip = await JSZip.loadAsync(find('zip'));
  const paths = Object.keys(zip.files);
  expect(paths).toContain('hashira-export/manifest.json');
  expect(paths.some((p) => p.startsWith('hashira-export/images/') && p.endsWith('.png'))).toBe(
    true,
  );
  const manifest = JSON.parse(
    await zip.file('hashira-export/metadata/images.json')!.async('string'),
  );
  expect(manifest[0].recordIds).toHaveLength(1);
  expect(zip.file('hashira-export/' + manifest[0].local_path)).not.toBeNull();
  expect(paths.some((p) => p.endsWith('.html'))).toBe(true);
});

for (const path of ['/custom', '/commerce', '/tables', '/rtl', '/dynamic']) {
  test(`complete core workflow persists, downloads a file and exports on ${path}`, async ({
    page,
  }) => {
    await harness(page, path);
    if (path === '/dynamic') await expect(page.locator('.js-card')).toHaveCount(3);
    const first = await page.evaluate(async () => {
      const h = window.hashira;
      const data = h.detect(document, location.href);
      await h.seed(location.href);
      const image = data.images.find((i) => i.url.startsWith(location.origin))!;
      const response = await fetch(image.url);
      const blob = await h.readBounded(response, 2_000_000);
      const mime = h.sniffMime(new Uint8Array(await blob.slice(0, 2048).arrayBuffer()))!;
      const size = await h.verifyImageBlob(blob, mime);
      const hash = await h.sha256(blob);
      await h.db.blobs.put({ hash, blob, mime, size: blob.size });
      const records = await h.db.records.where('jobId').equals('browser-fixture').toArray();
      await h.db.resources.put({
        id: 'workflow-image',
        jobId: 'browser-fixture',
        url: image.url,
        kind: 'image',
        recordIds: records.map((r) => r.id),
        hash,
        mime,
        state: 'FETCHED',
        attempts: 0,
        nextAt: 0,
      });
      return { hash, size, records: records.length, links: data.links.length };
    });
    expect(first.size.width).toBeGreaterThan(0);
    expect(first.links).toBeGreaterThan(0);
    const pending = page.waitForEvent('download');
    await page.evaluate(async () => {
      const r = await window.hashira.db.resources.get('workflow-image');
      const data = await window.hashira.db.blobs.get(r!.hash!);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(data!.blob);
      a.download = 'verified-image.bin';
      a.click();
    });
    const download = await pending;
    expect(await download.failure()).toBeNull();
    const output = await download.path();
    expect(output).toBeTruthy();
    const { readFile } = await import('node:fs/promises');
    const { createHash } = await import('node:crypto');
    expect(
      createHash('sha256')
        .update(await readFile(output!))
        .digest('hex'),
    ).toBe(first.hash);
    await page.reload();
    await page.addScriptTag({ url: origin + '/harness.js' });
    if (path === '/dynamic') await expect(page.locator('.js-card')).toHaveCount(3);
    const restored = await page.evaluate(async () => {
      await window.hashira.seed(location.href);
      return {
        records: await window.hashira.db.records.where('jobId').equals('browser-fixture').count(),
        resources: await window.hashira.db.resources.count(),
      };
    });
    expect(restored.records).toBe(first.records);
    expect(restored.resources).toBe(1);
    const zipped = await page.evaluate(async () => {
      const source = await (await fetch('/extension/sidepanel.js')).text();
      const asset = source.match(/assets\/worker-[\w-]+\.js/)![0];
      return new Promise<number[]>((resolve, reject) => {
        const worker = new Worker('/extension/' + asset, { type: 'module' });
        worker.onmessage = (e) => {
          if (e.data.type === 'error') {
            worker.terminate();
            reject(new Error(e.data.message));
          }
          if (e.data.type === 'done')
            void (e.data.blob as Blob).arrayBuffer().then((buf) => {
              worker.terminate();
              resolve([...new Uint8Array(buf)]);
            });
        };
        worker.postMessage({ jobId: 'browser-fixture', format: 'zip' });
      });
    });
    const zip = await JSZip.loadAsync(Uint8Array.from(zipped));
    const manifest = JSON.parse(
      await zip.file('hashira-export/metadata/images.json')!.async('string'),
    );
    expect(manifest).toHaveLength(1);
    expect(
      await zip.file('hashira-export/' + manifest[0].local_path)!.async('uint8array'),
    ).toHaveLength((await readFile(output!)).length);
  });
}
test('SVG parsing rejects active resources and validates safe diagrams', async ({ page }) => {
  await harness(page, '/custom');
  const result = await page.evaluate(async () => {
    const safe = await (await fetch('/assets/diagram.svg')).blob();
    const dimensions = await window.hashira.verifyImageBlob(safe, 'image/svg+xml');
    let blocked = false;
    try {
      await window.hashira.verifyImageBlob(
        new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>']),
        'image/svg+xml',
      );
    } catch {
      blocked = true;
    }
    return { dimensions, blocked };
  });
  expect(result).toEqual({ dimensions: { width: 320, height: 240 }, blocked: true });
});
test('all four catalog pages expose 100 distinct products', async ({ page }) => {
  const identities = new Set<string>();
  for (let n = 1; n <= 4; n++) {
    await harness(page, '/custom?page=' + n);
    const ids = await page.evaluate(() =>
      window.hashira.detect(document, location.href).records.map((r) => r.id),
    );
    ids.forEach((id) => identities.add(id));
  }
  expect(identities.size).toBe(100);
});

declare global {
  interface Window {
    __contentHandler: (
      message: Record<string, unknown>,
      sender: { id: string },
      respond: (value: {
        ok: boolean;
        data?: { records: unknown[]; html?: string };
        error?: string;
      }) => void,
    ) => unknown;
  }
}
test('bundled content engine applies bounded Load More, Full Capture and abort messages', async ({
  page,
}) => {
  await page.goto(origin + '/dynamic');
  await expect(page.locator('.js-card')).toHaveCount(3);
  await page.evaluate(() => {
    Object.assign(window, {
      chrome: {
        runtime: {
          id: 'content-qa',
          onMessage: {
            addListener: (handler: typeof window.__contentHandler) => {
              window.__contentHandler = handler;
            },
          },
          sendMessage: async () => ({ ok: true }),
        },
      },
    });
  });
  await page.addScriptTag({ url: origin + '/extension/content.js' });
  const result = await page.evaluate(
    () =>
      new Promise<{ ok: boolean; data?: { records: unknown[]; html?: string }; error?: string }>(
        (resolve) =>
          window.__contentHandler(
            {
              target: 'content',
              op: 'DETECT',
              requestId: 'normal',
              loadMoreClicks: 2,
              fullCapture: true,
            },
            { id: 'content-qa' },
            resolve,
          ),
      ),
  );
  expect(result.ok).toBe(true);
  expect(result.data?.records).toHaveLength(9);
  expect(result.data?.html).not.toContain('<script');
  const aborted = await page.evaluate(
    () =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        window.__contentHandler(
          { target: 'content', op: 'DETECT', requestId: 'slow', scrollSteps: 30 },
          { id: 'content-qa' },
          resolve,
        );
        setTimeout(
          () =>
            window.__contentHandler(
              { target: 'content', op: 'ABORT', requestId: 'slow' },
              { id: 'content-qa' },
              () => undefined,
            ),
          20,
        );
      }),
  );
  expect(aborted.ok).toBe(false);
  expect(aborted.error).toContain('cancelled');
});
