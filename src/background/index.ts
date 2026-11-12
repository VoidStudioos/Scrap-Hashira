import { captureBranch } from './capture';
import { deleteLocalJob } from '../storage/jobs';
import { db, log } from '../storage/db';
import { analyze, inject } from './browser';
import { checkpoint, pump } from './scheduler';
import { setJobState, recover } from '../engines/resume';
import { reconcileDownload } from './downloads';
import { canonical, validateConfig, inScope } from '../security/policy';
import { uid, hashText, errorText } from '../utils/core';
import type { Job, SelectedElement } from '../types';
import { validateProfile } from '../engines/learning';
async function arm() {
  if (!(await chrome.alarms.get('hashira-tick')))
    await chrome.alarms.create('hashira-tick', { periodInMinutes: 0.5 });
}
chrome.runtime.onInstalled.addListener(() => {
  void arm();
});
chrome.runtime.onStartup.addListener(() => {
  void recover('browser-restart', true).then(arm).then(pump);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'hashira-tick') void pump();
});
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state || delta.error) {
    void db.resources
      .where('downloadId')
      .equals(delta.id)
      .first()
      .then(async (task) => {
        if (task) await reconcileDownload(task.id);
      })
      .then(pump)
      .catch((e) => log('system', 'error', 'DOWNLOAD_EVENT', errorText(e)));
  }
});
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id || msg.target !== 'background') return;
  const run = async () => {
    await arm();
    const contentSender = !sender.url?.startsWith(chrome.runtime.getURL(''));
    if (contentSender && msg.op !== 'SELECTION')
      throw new Error('This action requires an extension page');
    switch (msg.op) {
      case 'PING':
        return { version: chrome.runtime.getManifest().version };
      case 'DETECT':
        return analyze(Number(msg.tabId), msg.options || {});
      case 'SELECT':
        await inject(Number(msg.tabId));
        await chrome.tabs.sendMessage(Number(msg.tabId), {
          target: 'content',
          op: 'SELECT',
          group: msg.group,
          recordCss: msg.recordCss,
        });
        return true;
      case 'SELECTION': {
        const data = msg.data as SelectedElement;
        if (!sender.tab?.url || canonical(data.url) !== canonical(sender.tab.url))
          throw new Error('Selection origin mismatch');
        await db.selections.put({ ...data, id: uid(), at: Date.now() });
        return true;
      }
      case 'CAPTURE_BRANCH': {
        const result = await captureBranch(
          Number(msg.tabId),
          String(msg.url || ''),
          String(msg.path || ''),
          msg.config || {},
          typeof msg.jobId === 'string' ? msg.jobId : undefined,
        );
        void pump();
        return result;
      }
      case 'CREATE_JOB': {
        const start = canonical(String(msg.url));
        if (!start) throw new Error('Choose an HTTP(S) page');
        const config = validateConfig(msg.config || {});
        const origin = new URL(start).origin;
        if (!inScope(start, origin, { ...config, branches: [] }))
          throw new Error('Start URL is excluded');
        const job: Job = {
          id: uid(),
          name: String(msg.name || new URL(start).hostname).slice(0, 100),
          state: 'CREATED',
          startUrl: start,
          origin,
          config,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          checkpoint: 0,
          blockedUntil: 0,
        };
        const seed = Number.isInteger(msg.tabId) ? await analyze(msg.tabId, config) : undefined;
        if (
          seed &&
          (canonical(seed.url) !== start ||
            canonical((await chrome.tabs.get(msg.tabId)).url || '') !== start)
        )
          throw new Error('The selected tab navigated. Analyze its current page again.');
        if (seed && (seed.authWall || (seed.status && seed.status >= 400)))
          throw new Error('The selected page needs login or returned an HTTP error.');
        await db.transaction(
          'rw',
          [db.jobs, db.pages, db.records, db.snapshots, db.resources, db.profiles, db.logs],
          async () => {
            await db.jobs.add(job);
            await db.pages.add({
              id: job.id + ':' + hashText(start),
              jobId: job.id,
              url: start,
              parentUrl: '',
              kind: 'page',
              branchId: config.branches.find((branch) =>
                inScope(start, origin, { ...config, branches: [branch] }),
              ),
              depth: 0,
              state: 'PENDING',
              attempts: 0,
              nextAt: 0,
            });
            if (seed) {
              const first = await db.pages.get(job.id + ':' + hashText(start));
              if (first) await checkpoint(first, job, seed);
            }
          },
        );
        return job;
      }
      case 'DELETE_JOB':
        await deleteLocalJob(String(msg.id));
        return true;
      case 'STATE':
        if (!['RUNNING', 'PAUSED', 'CANCELLED'].includes(msg.state))
          throw new Error('Invalid user-requested job state');
        await setJobState(String(msg.id), msg.state);
        void pump();
        return true;
      case 'TICK':
        void pump();
        return true;
      case 'PROFILE': {
        const p = validateProfile(msg.profile);
        await db.profiles.put(p);
        return p;
      }
      case 'RETRY_FAILED': {
        const id = String(msg.id);
        await db.pages
          .where('jobId')
          .equals(id)
          .filter((p) => p.state === 'FAILED' || p.state === 'BLOCKED')
          .modify({ state: 'PENDING', attempts: 0, error: undefined, nextAt: 0 });
        await db.resources
          .where('jobId')
          .equals(id)
          .filter((r) => r.state === 'FAILED' || r.state === 'BLOCKED')
          .modify({ state: 'PENDING', attempts: 0, error: undefined, nextAt: 0 });
        await db.jobs.update(id, { state: 'PAUSED', lastError: undefined });
        return true;
      }
      case 'APPROVE_ORIGIN': {
        const job = await db.jobs.get(String(msg.id));
        if (!job) throw new Error('Job missing');
        const origin = new URL(String(msg.origin)).origin;
        await db.jobs.update(job.id, {
          config: {
            ...job.config,
            approvedResourceOrigins: [...new Set([...job.config.approvedResourceOrigins, origin])],
          },
        });
        await db.resources
          .where('jobId')
          .equals(job.id)
          .filter((r) => r.state === 'BLOCKED' && r.url.startsWith(origin + '/'))
          .modify({ state: 'PENDING', attempts: 0, error: undefined, nextAt: 0 });
        return true;
      }
      default:
        throw new Error('Unknown command');
    }
  };
  void run()
    .then((data) => respond({ ok: true, data }))
    .catch((error) => respond({ ok: false, error: errorText(error) }));
  return true;
});
void arm();
