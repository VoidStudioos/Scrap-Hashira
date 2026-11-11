// This suite requires full Chromium with extension support, not chrome-headless-shell.
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
let context: BrowserContext;
let panel: Page;
let extensionId: string;
let temp: string;
async function message<T>(op: string, data: Record<string, unknown> = {}): Promise<T> {
  return panel.evaluate(
    async ({ op, data }) => {
      const result = await chrome.runtime.sendMessage({ target: 'background', op, ...data });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    { op, data },
  ) as Promise<T>;
}
test.describe.serial('Native MV3 installation and Chrome API acceptance', () => {
  test.beforeAll(async () => {
    temp = await mkdtemp(join(tmpdir(), 'hashira-native-'));
    const extension = join(temp, 'extension');
    await cp(resolve('dist'), extension, { recursive: true });
    context = await chromium.launchPersistentContext(join(temp, 'profile'), {
      executablePath: process.env.HASHIRA_NATIVE_CHROME || undefined,
      channel: process.env.HASHIRA_NATIVE_CHROME ? undefined : 'chromium',
      headless: true,
      acceptDownloads: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--enable-unsafe-extension-debugging',
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
    if (!context.serviceWorkers().length) {
      const session = await context.browser()!.newBrowserCDPSession();
      await session.send('Extensions.loadUnpacked', { path: extension });
    }
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    extensionId = new URL(worker.url()).host;
    panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  });
  test.afterAll(async () => {
    await context?.close();
    if (temp) await rm(temp, { recursive: true, force: true });
  });
  test('production manifest installs with no required host permissions', async () => {
    const ping = await message<{ version: string }>('PING');
    expect(ping.version).toBe('0.2.2');
    expect(await panel.evaluate(() => chrome.runtime.getManifest().host_permissions || [])).toEqual(
      [],
    );
    await expect(panel.locator('.logo')).toBeVisible();
  });
  test('native crawler downloads, pauses, resumes and exports associated data', async () => {
    // A fixture-only grant avoids automating Chrome permission dialogs.
    const extension = join(temp, 'extension');
    const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
    manifest.host_permissions = ['http://127.0.0.1/*'];
    await writeFile(join(extension, 'manifest.json'), JSON.stringify(manifest));
    const session = await context.browser()!.newBrowserCDPSession();
    await session.send('Extensions.uninstall', { id: extensionId });
    const loaded = (await session.send('Extensions.loadUnpacked', { path: extension })) as {
      id: string;
    };
    extensionId = loaded.id;
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const job = await message<{ id: string }>('CREATE_JOB', {
      url: 'http://127.0.0.1:4173/custom?page=1',
      name: 'Native fixture',
      config: {
        maxPages: 2,
        maxDepth: 0,
        maxImages: 8,
        delayMs: 250,
        timeoutMs: 15000,
        fullCapture: true,
        downloadImages: true,
        include: ['http://127.0.0.1:4173/custom*'],
      },
    });
    await message('STATE', { id: job.id, state: 'RUNNING' });
    await expect
      .poll(async () => panel.locator('.job-card').first().innerText(), { timeout: 60000 })
      .toContain('Checkpoint');
    await message('STATE', { id: job.id, state: 'PAUSED' });
    await expect(panel.getByText('PAUSED', { exact: true })).toBeVisible();
    await message('STATE', { id: job.id, state: 'RUNNING' });
    await expect
      .poll(
        async () => {
          await message('TICK');
          return panel.locator('.job-card').first().innerText();
        },
        { timeout: 60000 },
      )
      .toContain('COMPLETED');
    const files = await panel.evaluate(() => chrome.downloads.search({ state: 'complete' }));
    expect(files.some((file) => file.exists && /Hashira/.test(file.filename))).toBe(true);
  });
  test('worker termination preserves durable queues', async () => {
    const job = await message<{ id: string }>('CREATE_JOB', {
      url: 'http://127.0.0.1:4173/commerce',
      name: 'Termination fixture',
      config: {
        maxPages: 2,
        delayMs: 250,
        downloadImages: false,
        include: ['http://127.0.0.1:4173/commerce*'],
      },
    });
    await message('STATE', { id: job.id, state: 'RUNNING' });
    const cdp = await context.newCDPSession(panel);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    await message('PING');
    await message('TICK');
    await expect
      .poll(
        async () => {
          await message('TICK');
          await panel.getByRole('button', { name: 'Jobs Manager', exact: true }).click();
          return panel.locator('.job-card').filter({ hasText: 'Termination fixture' }).innerText();
        },
        { timeout: 60000 },
      )
      .toContain('COMPLETED');
  });
});
