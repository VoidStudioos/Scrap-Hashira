import { useState } from 'react';
import { db, stats } from '../storage/db';
import { useLive } from '../sidepanel/useLive';
import { useUI, command } from '../sidepanel/store';
import { messages } from '../localization';
import type { Job } from '../types';
import { exportJob, streamingJSONL } from '../exports';
import type { ExportFormat } from '../exports/worker';
import { originPattern } from '../security/policy';
export function JobCard({ job, exports = false }: { job: Job; exports?: boolean }) {
  const { settings, set } = useUI();
  const t = messages[settings.language];
  const data = useLive(() => stats(job.id), [job.id]);
  const resources = useLive(() => db.resources.where('jobId').equals(job.id).toArray(), [job.id]);
  const [percent, setPercent] = useState<number | undefined>();
  const act = (fn: () => Promise<unknown>) => {
    void fn().catch((e) => set({ notice: String(e) }));
  };
  const origins = [
    ...new Set(
      resources
        ?.filter((r) => r.state === 'BLOCKED' && r.url.startsWith('http'))
        .map((r) => new URL(r.url).origin) || [],
    ),
  ].filter((o) => o !== job.origin);
  return (
    <article className="job-card">
      <div className="section-heading">
        <h3>{job.name}</h3>
        <span className={'state ' + job.state.toLowerCase()}>{job.state}</span>
      </div>
      <p className="url" dir="ltr">
        {job.startUrl}
      </p>
      <div className="metrics-strip">
        {data?.processed || 0}/{data?.discovered || 0} {t.pages} · {data?.records || 0} {t.records}{' '}
        · {data?.downloaded || 0} {t.downloaded}
      </div>
      {data && data.discovered > 0 && (
        <progress max={data.discovered} value={data.processed} aria-label={t.pages} />
      )}
      <small className="muted">
        Checkpoint {job.checkpoint} ·{' '}
        {new Date(job.updatedAt).toLocaleString(settings.language === 'fa' ? 'fa-IR' : 'en')}
      </small>
      {job.lastError && <p className="warning">{job.lastError}</p>}
      {origins.map((origin) => (
        <div className="origin-request" key={origin}>
          <span dir="ltr">{origin}</span>
          <button
            onClick={() =>
              act(async () => {
                if (await chrome.permissions.request({ origins: [originPattern(origin)] })) {
                  await command('APPROVE_ORIGIN', { id: job.id, origin });
                  set({ notice: t.resume });
                }
              })
            }
          >
            {t.permission}
          </button>
        </div>
      ))}
      <div className="button-row">
        {job.state === 'RUNNING' ? (
          <button onClick={() => act(() => command('STATE', { id: job.id, state: 'PAUSED' }))}>
            {t.pause}
          </button>
        ) : (
          !['CANCELLED', 'COMPLETED'].includes(job.state) && (
            <button
              className="primary"
              onClick={() =>
                act(async () => {
                  if (!(await chrome.permissions.request({ origins: [originPattern(job.origin)] })))
                    throw new Error('Site permission denied');
                  await command('STATE', { id: job.id, state: 'RUNNING' });
                })
              }
            >
              {t.resume}
            </button>
          )
        )}
        {!['CANCELLED', 'COMPLETED'].includes(job.state) && (
          <button onClick={() => act(() => command('STATE', { id: job.id, state: 'CANCELLED' }))}>
            {t.cancel}
          </button>
        )}
        {job.state === 'FAILED' && (
          <button onClick={() => act(() => command('RETRY_FAILED', { id: job.id }))}>
            {t.retry}
          </button>
        )}
        <button
          onClick={() => {
            set({ nav: 'exports' });
          }}
        >
          {t.export}
        </button>
        {job.state !== 'RUNNING' && (
          <button
            onClick={() => {
              if (
                window.confirm(
                  settings.language === 'fa'
                    ? 'داده محلی این کار حذف شود؟ فایل‌های Downloads باقی می‌مانند.'
                    : 'Delete this job’s local data? Files already in Downloads are retained.',
                )
              )
                act(() => command('DELETE_JOB', { id: job.id }));
            }}
          >
            {settings.language === 'fa' ? 'حذف داده محلی' : 'Delete local data'}
          </button>
        )}
      </div>
      {exports && (
        <div className="export-options">
          {(['json', 'jsonl', 'csv', 'xlsx', 'zip', 'html'] as ExportFormat[]).map((format) => (
            <button
              disabled={percent !== undefined}
              key={format}
              onClick={() => {
                setPercent(0);
                void exportJob(job.id, format, setPercent)
                  .then((filename) => set({ notice: filename }))
                  .catch((e) => set({ notice: String(e) }))
                  .finally(() => setPercent(undefined));
              }}
            >
              {format.toUpperCase()}
              {format === 'html' ? ' ZIP' : ''}
            </button>
          ))}
          <button onClick={() => act(() => streamingJSONL(job.id))}>JSONL ↧ stream</button>
          {percent !== undefined && <progress value={percent} max="100" />}
        </div>
      )}
      <details>
        <summary>{t.diagnostics}</summary>
        {resources
          ?.filter((r) => r.error)
          .slice(0, 20)
          .map((r) => (
            <p className="warning" key={r.id}>
              <span dir="ltr">{r.url.slice(0, 100)}</span>
              <br />
              {r.error}
            </p>
          ))}
      </details>
    </article>
  );
}
export function Jobs({ exports = false }: { exports?: boolean }) {
  const { settings } = useUI();
  const t = messages[settings.language];
  const jobs = useLive(() => db.jobs.orderBy('updatedAt').reverse().toArray(), []);
  return (
    <section>
      <div className="section-heading">
        <h2>{exports ? t.exports : t.jobs}</h2>
        <span className="badge">{jobs?.length || 0}</span>
      </div>
      {!jobs?.length && <p className="empty">{t.noJob}</p>}
      {jobs?.map((job) => (
        <JobCard key={job.id} job={job} exports={exports} />
      ))}
    </section>
  );
}
