import type { Detection, Job, Response } from '../types';
import { db } from '../storage/db';
import { errorText } from '../utils/core';
import { originPattern } from '../security/policy';
export async function hasOrigin(origin: string) {
  return chrome.permissions.contains({ origins: [originPattern(origin)] });
}
export async function inject(tabId: number) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}
export function sendContentCommand<T>(
  tabId: number,
  message: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  const requestId = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      void chrome.tabs
        .sendMessage(tabId, { target: 'content', op: 'ABORT', requestId })
        .catch(() => undefined);
      reject(new Error('Content analysis timed out'));
    }, timeoutMs);
    void chrome.tabs.sendMessage(tabId, { ...message, requestId }).then(
      (data) => {
        clearTimeout(timer);
        resolve(data as T);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
export async function analyze(
  tabId: number,
  options: Partial<Job['config']> = {},
): Promise<Detection> {
  await inject(tabId);
  const profiles = await db.profiles.toArray();
  const result = await sendContentCommand<Response<Detection>>(
    tabId,
    {
      target: 'content',
      op: 'DETECT',
      profiles,
      ...options,
    },
    Math.max(3000, Math.min(25000, options.timeoutMs || 20000)),
  );
  if (!result?.ok)
    throw new Error(result && !result.ok ? result.error : 'No response from this page');
  return result.data;
}
export async function waitForTab(tabId: number, timeout: number) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('Page load timed out')), timeout);
    const listener = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && change.status === 'complete') done();
    };
    const removed = (id: number) => {
      if (id === tabId) done(new Error('Scraping tab was closed'));
    };
    let settled = false;
    function done(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.onRemoved.removeListener(removed);
      if (error) reject(error);
      else resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.onRemoved.addListener(removed);
    void chrome.tabs
      .get(tabId)
      .then((t) => {
        if (t.status === 'complete') done();
      })
      .catch((e) => done(new Error(errorText(e))));
  });
}
let opening: Promise<void> | undefined;
export async function offscreen() {
  if (!opening)
    opening = (async () => {
      if (!(await chrome.offscreen.hasDocument()))
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: [chrome.offscreen.Reason.BLOBS],
          justification: 'Validate local image bytes and create download blob URLs.',
        });
    })();
  try {
    await opening;
  } finally {
    opening = undefined;
  }
}
export async function offscreenCall<T>(op: string, data: Record<string, unknown>): Promise<T> {
  await offscreen();
  const r = (await chrome.runtime.sendMessage({ target: 'offscreen', op, ...data })) as Response<T>;
  if (!r?.ok) throw new Error(r && !r.ok ? r.error : 'Resource processor unavailable');
  return r.data;
}
