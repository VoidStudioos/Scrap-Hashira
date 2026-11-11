import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:4173';
test('side panel uses actual preview data and supports Persian RTL, light theme and narrow width', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const event = { addListener: () => undefined, removeListener: () => undefined };
    Object.assign(window, {
      chrome: {
        runtime: {
          id: 'test',
          sendMessage: async (msg: { op: string }) => {
            if (msg.op === 'DETECT') {
              const html = await (await fetch('/custom')).text();
              const doc = new DOMParser().parseFromString(html, 'text/html');
              return { ok: true, data: window.hashira.detect(doc, location.origin + '/custom') };
            }
            return { ok: true, data: true };
          },
        },
        storage: { local: { get: async () => ({}), set: async () => undefined } },
        permissions: {
          request: async () => true,
          getAll: async () => ({ origins: [] }),
          remove: async () => true,
        },
        tabs: {
          query: async () => [{ id: 1, url: location.origin + '/custom', active: true }],
          onActivated: event,
          onUpdated: event,
        },
      },
    });
  });
  await page.goto(origin + '/extension/sidepanel.html');
  await page.addScriptTag({ url: origin + '/harness.js' });
  await expect(page.getByRole('heading', { name: 'Your website.' })).toBeVisible();
  await page.getByRole('button', { name: 'Analyze current tab' }).click();
  await expect(page.locator('.data-table').first().locator('tbody tr')).toHaveCount(25);
  await expect(page.locator('.stats-grid .stat').first().locator('strong')).toHaveText('0');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('combobox', { name: 'پوسته', exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.setViewportSize({ width: 420, height: 900 });
  await page.getByRole('button', { name: 'داشبورد', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/ui-rtl-internal.png', fullPage: true });
  expect(errors).toEqual([]);
});

declare global {
  interface Window {
    __qaCommands: Record<string, unknown>[];
  }
}
async function optionsWorkspace(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const event = { addListener: () => undefined, removeListener: () => undefined };
    window.__qaCommands = [];
    Object.assign(window, {
      chrome: {
        runtime: {
          id: 'qa',
          getManifest: () => ({ version: '0.2.2' }),
          sendMessage: async (msg: Record<string, unknown>) => {
            window.__qaCommands.push(msg);
            if (msg.op === 'DETECT') {
              const doc = new DOMParser().parseFromString(
                await (await fetch('/custom')).text(),
                'text/html',
              );
              return { ok: true, data: window.hashira.detect(doc, location.origin + '/custom') };
            }
            if (msg.op === 'PROFILE') {
              const profile = window.hashira.validateProfile(msg.profile);
              await window.hashira.db.profiles.put(profile);
              return { ok: true, data: profile };
            }
            if (msg.op === 'CREATE_JOB') {
              const job = {
                id: crypto.randomUUID(),
                name: String(msg.name),
                state: 'CREATED' as const,
                startUrl: String(msg.url),
                origin: new URL(String(msg.url)).origin,
                config: msg.config as typeof window.hashira.DEFAULT_CONFIG,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                checkpoint: 0,
                blockedUntil: 0,
              };
              await window.hashira.db.jobs.put(job);
              return { ok: true, data: job };
            }
            if (msg.op === 'STATE') {
              await window.hashira.db.jobs.update(String(msg.id), {
                state: msg.state as 'PAUSED' | 'RUNNING' | 'CANCELLED',
              });
            }
            return { ok: true, data: true };
          },
        },
        storage: {
          local: {
            get: async () => ({
              settings: JSON.parse(localStorage.getItem('qa-settings') || 'null'),
            }),
            set: async (data: { settings: unknown }) => {
              localStorage.setItem('qa-settings', JSON.stringify(data.settings));
            },
          },
        },
        permissions: {
          request: async () => true,
          getAll: async () => ({ origins: [] }),
          remove: async () => true,
        },
        tabs: {
          query: async () => [{ id: 1, url: location.origin + '/custom', active: true }],
          onActivated: event,
          onUpdated: event,
        },
      },
    });
  });
  await page.goto(origin + '/extension/sidepanel.html');
  await page.addScriptTag({ url: origin + '/harness.js' });
  await expect(page.locator('.logo')).toBeVisible();
}
test('all twelve navigation options render and configuration reaches the job queue', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await optionsWorkspace(page);
  const items = [
    'Dashboard',
    'One-Click Scraper',
    'Smart Site Explorer',
    'Smart Learning',
    'Visual Selector',
    'Table Extractor',
    'Image Collector',
    'Detail Page Crawler',
    'Jobs Manager',
    'Export Center',
    'Settings',
    'Diagnostics',
  ];
  for (const name of items) {
    const button = page.getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'FAST', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Concurrent downloads', exact: true }),
  ).toHaveValue('6');
  await page.getByRole('spinbutton', { name: 'Max pages', exact: true }).fill('12');
  await page.getByRole('spinbutton', { name: 'Request delay (ms)', exact: true }).fill('900');
  await page.getByRole('spinbutton', { name: 'Scroll steps', exact: true }).fill('1');
  await page.getByRole('spinbutton', { name: 'Load More clicks', exact: true }).fill('1');
  await page.getByRole('spinbutton', { name: 'Timeout (ms)', exact: true }).fill('5000');
  await page.getByRole('checkbox', { name: 'Full capture', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Accessible PDF documents', exact: true }).check();
  await page
    .getByRole('combobox', { name: 'Traversal mode', exact: true })
    .selectOption('pagination');
  await page.getByText('URL filters & API', { exact: true }).click();
  await page
    .getByRole('textbox', {
      name: 'Authorized JSON API paths (optional, one per line)',
      exact: true,
    })
    .fill('/api/products');
  await page.getByRole('button', { name: 'Save defaults', exact: true }).click();
  await page.getByRole('button', { name: 'One-Click Scraper', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze current tab' }).click();
  await expect(page.locator('.data-table').first().locator('tbody tr')).toHaveCount(25);
  await page.getByRole('button', { name: 'Start extraction' }).click();
  await expect(page.getByText('RUNNING', { exact: true })).toBeVisible();
  const commands = await page.evaluate(() => window.__qaCommands);
  const analysis = commands.find((m) => m.op === 'DETECT')!;
  expect(analysis.options).toMatchObject({ scrollSteps: 1, loadMoreClicks: 1, timeoutMs: 5000 });
  const job = commands.find((m) => m.op === 'CREATE_JOB')!;
  expect(job.config).toMatchObject({
    maxPages: 12,
    delayMs: 900,
    downloadConcurrency: 6,
    fullCapture: true,
    downloadDocuments: true,
    traverse: 'pagination',
    apiPaths: ['/api/products'],
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('image selection is carried into extraction instead of downloading an old selection', async ({
  page,
}) => {
  await optionsWorkspace(page);
  await page.getByRole('button', { name: 'Analyze current tab' }).click();
  await page.getByRole('button', { name: 'Image Collector', exact: true }).click();
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  const imageChecks = page.locator('.image-check input');
  await expect(imageChecks.first()).not.toBeChecked();
  await imageChecks.first().check();
  await page.getByRole('button', { name: 'Start extraction' }).click();
  const created = await page.evaluate(() => window.__qaCommands.find((m) => m.op === 'CREATE_JOB'));
  expect((created!.config as { selectedImageUrls: string[] }).selectedImageUrls).toHaveLength(1);
});
test('editing a saved learning profile updates its identity and new profiles remain separate', async ({
  page,
}) => {
  await optionsWorkspace(page);
  await page.getByRole('button', { name: 'Smart Learning', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Parts');
  await page.getByRole('textbox', { name: 'Record CSS selector', exact: true }).fill('.unit');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.hashira.db.profiles.count())).toBe(1);
  const firstId = await page.evaluate(
    async () => (await window.hashira.db.profiles.toArray())[0]!.id,
  );
  await page.getByRole('button', { name: 'Site profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Parts corrected');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect
    .poll(() => page.evaluate(async () => (await window.hashira.db.profiles.toArray())[0]!.name))
    .toBe('Parts corrected');
  expect(await page.evaluate(async () => (await window.hashira.db.profiles.toArray())[0]!.id)).toBe(
    firstId,
  );
  expect(await page.evaluate(() => window.hashira.db.profiles.count())).toBe(1);
  await page.getByRole('button', { name: 'New profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Another group');
  await page.getByRole('textbox', { name: 'Record CSS selector', exact: true }).fill('.unit');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.hashira.db.profiles.count())).toBe(2);
});
