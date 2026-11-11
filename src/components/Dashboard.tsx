import { useEffect, useState } from 'react';
import { useUI } from '../sidepanel/store';
import { messages } from '../localization';
import { db, stats } from '../storage/db';
import { useLive } from '../sidepanel/useLive';
import { Preview } from './Preview';
import { JobCard } from './Jobs';
export function Dashboard() {
  const { settings, detection, set } = useUI();
  const t = messages[settings.language];
  const totals = useLive(() => stats(), []);
  const recent = useLive(() => db.jobs.orderBy('updatedAt').reverse().limit(1).toArray(), []);
  const [usage, setUsage] = useState(0);
  useEffect(() => {
    void navigator.storage.estimate().then((s) => setUsage(s.usage || 0));
  }, [totals]);
  const metrics = [
    { label: t.discovered, value: totals?.discovered || 0 },
    { label: t.pages, value: totals?.processed || 0 },
    { label: t.records, value: totals?.records || 0 },
    { label: t.tableCount, value: totals?.tables || 0 },
    { label: t.imageCount, value: totals?.images || 0 },
    { label: t.downloaded, value: totals?.downloaded || 0 },
    { label: t.failed, value: totals?.failed || 0 },
    { label: t.storage, value: (usage / 1024 / 1024).toFixed(1) + ' MB' },
  ];
  return (
    <>
      <div className="hero">
        <span className="eyebrow">HASHIRA / WORKSPACE</span>
        <h1>
          {settings.language === 'fa'
            ? 'داده‌های سایت، در اختیار شما.'
            : 'Your website.\nYour dataset.'}
        </h1>
        <p>{t.draft}</p>
        <div className="hero-footer">
          <span className="status-dot" />
          {t.local}
          <button className="text-button" onClick={() => set({ nav: 'scraper' })}>
            {t.scraper} ↗
          </button>
        </div>
      </div>
      <div className="stats-grid">
        {metrics.map((m, i) => (
          <div className="stat" key={m.label}>
            <span className="stat-index">0{i + 1}</span>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
      {recent?.[0] && (
        <>
          <div className="section-heading">
            <h2>{t.live}</h2>
            <button className="text-button" onClick={() => set({ nav: 'jobs' })}>
              {t.jobs} ↗
            </button>
          </div>
          <JobCard job={recent[0]} />
        </>
      )}
      <Preview data={detection} />
    </>
  );
}
