import { detect } from '../engines/detection';
import { startSelector } from './selector';
import type { Profile } from '../types';
import { wait, errorText } from '../utils/core';
declare global {
  interface Window {
    __hashiraInstalled?: boolean;
  }
}
async function settle(timeout = 1200) {
  await new Promise<void>((resolve) => {
    let quiet: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      clearTimeout(quiet);
      quiet = setTimeout(done, 250);
    });
    const hard = setTimeout(done, timeout);
    function done() {
      clearTimeout(quiet);
      clearTimeout(hard);
      observer.disconnect();
      resolve();
    }
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    quiet = setTimeout(done, 250);
  });
}
if (!window.__hashiraInstalled) {
  window.__hashiraInstalled = true;
  const cancelled = new Set<string>();
  const activeRequests = new Set<string>();
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (sender.id !== chrome.runtime.id || msg.target !== 'content') return;
    if (msg.op === 'ABORT') {
      if (activeRequests.has(String(msg.requestId))) cancelled.add(String(msg.requestId));
      respond({ ok: true, data: true });
      return;
    }
    if (msg.op === 'DETECT') activeRequests.add(String(msg.requestId));
    const check = () => {
      if (cancelled.has(String(msg.requestId))) throw new Error('Analysis cancelled');
    };
    const run = async () => {
      if (msg.op === 'SELECT') {
        startSelector(typeof msg.group === 'string' ? msg.group : 'default', msg.recordCss || '');
        return true;
      }
      if (msg.op === 'DETECT') {
        for (let i = 0; i < Math.min(Number(msg.scrollSteps) || 0, 30); i++) {
          check();
          window.scrollBy(0, Math.max(400, window.innerHeight * 0.8));
          await settle(400);
        }
        for (let i = 0; i < Math.min(Number(msg.loadMoreClicks) || 0, 20); i++) {
          check();
          const data = detect(document, location.href);
          if (!data.loadMore) break;
          const button = document.querySelector<HTMLElement>(data.loadMore);
          if (!button || button.matches('[disabled],[aria-disabled="true"]')) break;
          button.click();
          await settle(900);
        }
        await settle();
        check();
        const data = detect(document, location.href, {
          profiles: (msg.profiles as Profile[]) || [],
          profileId: msg.profileId,
          candidateId: msg.candidateId,
          candidateIds: msg.candidateIds,
          profileIds: msg.profileIds,
          fullCapture: !!msg.fullCapture,
        });
        return data;
      }
      if (msg.op === 'PING') return { url: location.href };
      throw new Error('Unknown content command');
    };
    void run()
      .then((data) => respond({ ok: true, data }))
      .catch((e) => respond({ ok: false, error: errorText(e) }))
      .finally(() => {
        cancelled.delete(String(msg.requestId));
        activeRequests.delete(String(msg.requestId));
      });
    return true;
  });
}
// Give late framework hydration one turn before any caller requests analysis.
void wait(0);
