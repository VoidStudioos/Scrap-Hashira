import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
const origin = 'http://127.0.0.1:4173';
test('classifies hierarchy, identifiers, quantity and extensionless image click targets automatically', async ({
  page,
}) => {
  await page.goto(origin + '/semantic');
  await page.addScriptTag({ url: origin + '/harness.js' });
  const data = await page.evaluate(() => window.hashira.detect(document, location.href));
  expect(data.records).toHaveLength(2);
  const semantic = data.semantic!;
  expect(semantic.categories.find((c) => c.code === '02')?.parentId).toBe(
    semantic.categories.find((c) => c.code === '01')?.id,
  );
  expect(semantic.fields.some((f) => f.kind === 'code' && f.raw === '00045')).toBe(true);
  expect(semantic.fields.some((f) => f.kind === 'quantity' && f.value === 12)).toBe(true);
  expect(semantic.fields.some((f) => f.kind === 'price' && f.value === 850000)).toBe(true);
  expect(data.images.some((i) => i.url === origin + '/media/full?id=45')).toBe(true);
  expect(data.images.some((i) => i.url === origin + '/product/002')).toBe(false);
  expect(
    semantic.imageLinks.some(
      (l) => l.targetUrl?.includes('/media/full') && l.relation === 'candidate-image',
    ),
  ).toBe(true);
});
test('writes separate category/type files and verifies a clickable original image by actual MIME bytes', async ({
  page,
}) => {
  await page.goto(origin + '/semantic');
  await page.addScriptTag({ url: origin + '/harness.js' });
  const bytes = await page.evaluate(async () => {
    const h = window.hashira;
    const jobId = await h.seed(location.href);
    const response = await fetch('/media/full?id=45');
    const blob = await response.blob();
    const mime = h.sniffMime(new Uint8Array(await blob.slice(0, 2048).arrayBuffer()))!;
    await h.verifyImageBlob(blob, mime);
    const hash = await h.sha256(blob);
    await h.db.blobs.put({ hash, blob, mime, size: blob.size });
    const records = await h.db.records.where('jobId').equals(jobId).toArray();
    await h.db.resources.put({
      id: 'semantic-image',
      jobId,
      url: location.origin + '/media/full?id=45',
      kind: 'image',
      recordIds: records.map((r) => r.id),
      state: 'FETCHED',
      attempts: 0,
      nextAt: 0,
      hash,
      mime,
    });
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
          void (e.data.blob as Blob).arrayBuffer().then((buffer) => {
            worker.terminate();
            resolve([...new Uint8Array(buffer)]);
          });
      };
      worker.postMessage({ jobId, format: 'zip' });
    });
  });
  const zip = await JSZip.loadAsync(Uint8Array.from(bytes));
  const categories = JSON.parse(
    await zip.file('hashira-export/categories/index.json')!.async('string'),
  ) as { label: string; folder: string }[];
  const category = categories.find((c) => c.label === 'سیستم ترمز')!;
  expect(category).toBeTruthy();
  for (const name of [
    'codes.json',
    'numbers.csv',
    'prices.csv',
    'quantities.csv',
    'texts.csv',
    'records.json',
    'images.json',
    'index.html',
  ])
    expect(zip.file('hashira-export/' + category.folder + '/' + name)).not.toBeNull();
  const codes = JSON.parse(
    await zip.file('hashira-export/' + category.folder + '/codes.json')!.async('string'),
  );
  expect(codes.some((f: { raw: string }) => f.raw === '00045')).toBe(true);
  const targets = JSON.parse(
    await zip.file('hashira-export/classification/image-links.json')!.async('string'),
  );
  const target = targets.find((l: { targetUrl?: string }) => l.targetUrl?.includes('/media/full'));
  expect(target.target_verification).toBe('verified-image');
  expect(target.mime).toBe('image/avif');
  expect(zip.file('hashira-export/' + target.local_path)).not.toBeNull();
  const html = await zip.file('hashira-export/' + category.folder + '/index.html')!.async('string');
  expect(html).toContain('Open verified image file');
  expect(html).not.toContain('<script');
});
