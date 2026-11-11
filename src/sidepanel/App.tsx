import { BranchCapture } from '../components/BranchCapture';
import { version } from '../../package.json';
import { Dashboard } from '../components/Dashboard';
import { Tables } from '../components/Tables';
import { Images } from '../components/Images';
import { Diagnostics } from '../components/Diagnostics';
import { Settings } from '../components/Settings';
import { useEffect, useState } from 'react';
import { useUI, command, loadSettings, saveSettings, selectPage } from './store';
import { messages, type MessageKey } from '../localization';
import { Preview } from '../components/Preview';
import { Scope } from '../components/Scope';
import { Explorer } from '../components/Explorer';
import { Learning } from '../components/Learning';
import { Jobs } from '../components/Jobs';
import { originPattern, webUrl, canonical } from '../security/policy';
import type { Detection, Job } from '../types';
const navigation: { key: MessageKey; icon: string }[] = [
  { key: 'dashboard', icon: '▦' },
  { key: 'scraper', icon: '⌘' },
  { key: 'explorer', icon: '⌁' },
  { key: 'learning', icon: '◈' },
  { key: 'selector', icon: '⌖' },
  { key: 'tables', icon: '▤' },
  { key: 'images', icon: '▧' },
  { key: 'details', icon: '↳' },
  { key: 'jobs', icon: '▣' },
  { key: 'exports', icon: '⇩' },
  { key: 'settings', icon: '⚙' },
  { key: 'diagnostics', icon: '◉' },
];
export function App() {
  const { nav, settings, set, detection, url, tabId, busy, notice, config } = useUI();
  const t = messages[settings.language];
  const [webTabs, setWebTabs] = useState<chrome.tabs.Tab[]>([]);
  useEffect(() => {
    void loadSettings().catch((e) => set({ notice: String(e) }));
    const sync = async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const candidates = tabs.filter((tab) => tab.url && webUrl(tab.url));
      setWebTabs(candidates);
      const active =
        candidates.find((tab) => tab.active) ||
        candidates.find((tab) => tab.id === useUI.getState().tabId) ||
        candidates[0];
      if (active?.id && !useUI.getState().busy) {
        selectPage(active.id, active.url || '');
      }
    };
    void sync();
    chrome.tabs.onActivated.addListener(sync);
    const updated = (_id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (info.status === 'complete') void sync();
    };
    chrome.tabs.onUpdated.addListener(updated);
    const timer = setInterval(() => {
      void command('TICK').catch(() => undefined);
    }, 3000);
    return () => {
      chrome.tabs.onActivated.removeListener(sync);
      chrome.tabs.onUpdated.removeListener(updated);
      clearInterval(timer);
    };
  }, [set]);
  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.documentElement.dir = settings.language === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);
  const run = (work: () => Promise<unknown>) => {
    set({ busy: true, notice: '' });
    void work()
      .catch((error) => set({ notice: String(error) }))
      .finally(() => set({ busy: false }));
  };
  const analyze = () => {
    if (!url || !tabId) {
      set({
        notice:
          settings.language === 'fa'
            ? 'ابتدا یک سایت را در تب مرورگر باز کنید.'
            : 'Open an HTTP(S) website in another tab first.',
      });
      return;
    }
    const request = chrome.permissions.request({ origins: [originPattern(new URL(url).origin)] });
    run(async () => {
      if (!(await request)) throw new Error('Site permission denied');
      const data = await command<Detection>('DETECT', {
        tabId,
        options: {
          profileId: config.profileId,
          candidateId: config.candidateId,
          candidateIds: config.candidateIds,
          profileIds: config.profileIds,
          scrollSteps: config.scrollSteps,
          timeoutMs: config.timeoutMs,
          loadMoreClicks: config.loadMoreClicks,
        },
      });
      const active = useUI.getState();
      if (active.tabId !== tabId || canonical(active.url) !== canonical(url)) return;
      set({
        detection: data,
        url: data.url,
        notice: data.authWall
          ? 'Authentication/access wall detected. Complete manual login first.'
          : '',
      });
    });
  };
  const start = () => {
    if (!url || !detection) return;
    const request = chrome.permissions.request({ origins: [originPattern(new URL(url).origin)] });
    run(async () => {
      if (!(await request)) throw new Error('Site permission denied');
      const job = await command<Job>('CREATE_JOB', {
        url,
        name: detection.title || new URL(url).hostname,
        config: nav === 'details' ? { ...config, traverse: 'details' } : config,
      });
      await command('STATE', { id: job.id, state: 'RUNNING' });
      set({ nav: 'jobs', notice: '' });
    });
  };
  const analyzeNav = [
    'dashboard',
    'scraper',
    'explorer',
    'tables',
    'images',
    'details',
    'selector',
    'learning',
  ].includes(nav);
  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="logo">
          <span className="brand-mark">H</span>
          <div>
            <strong>HASHIRA</strong>
            <small>SCRAPER</small>
          </div>
          <span className="version">{version}</span>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.key}
              aria-label={t[item.key]}
              title={t[item.key]}
              className={nav === item.key ? 'nav-item active' : 'nav-item'}
              aria-current={nav === item.key ? 'page' : undefined}
              onClick={() => set({ nav: item.key })}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{t[item.key]}</span>
              {nav === item.key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <span className="status-dot" />
          {t.local}
          <div className="rail-controls">
            <button
              aria-label="Switch language"
              onClick={() => {
                void saveSettings({
                  ...settings,
                  language: settings.language === 'en' ? 'fa' : 'en',
                });
              }}
            >
              {settings.language === 'en' ? 'FA' : 'EN'}
            </button>
            <button
              aria-label="Toggle theme"
              onClick={() => {
                void saveSettings({
                  ...settings,
                  theme: settings.theme === 'dark' ? 'light' : 'dark',
                });
              }}
            >
              {settings.theme === 'dark' ? '☼' : '☾'}
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{t.current}</span>
            <div className="website">
              <span className="status-dot" />
              <select
                aria-label="Website tab"
                value={tabId || ''}
                onChange={(e) => {
                  const tab = webTabs.find((t) => t.id === Number(e.target.value));
                  if (tab?.id && tab.url) selectPage(tab.id, tab.url);
                }}
              >
                {!webTabs.length && <option value="">Open a website</option>}
                {webTabs.map((tab) => (
                  <option value={tab.id} key={tab.id}>
                    {tab.url ? new URL(tab.url).hostname : tab.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <span className="badge local-badge">LOCAL</span>
          {analyzeNav && (
            <button className="primary analyze" disabled={busy} onClick={analyze}>
              {busy ? '…' : t.analyze} <span>↗</span>
            </button>
          )}
        </header>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss"
              onClick={() => set({ notice: '' })}
            >
              ×
            </button>
          </div>
        )}
        <div className="content">
          {analyzeNav && <p className="permission-help">{t.permissionHelp}</p>}
          {nav === 'dashboard' ? (
            <Dashboard />
          ) : nav === 'explorer' ? (
            <Explorer />
          ) : nav === 'learning' || nav === 'selector' ? (
            <Learning />
          ) : nav === 'tables' ? (
            <Tables />
          ) : nav === 'images' ? (
            <Images />
          ) : nav === 'jobs' ? (
            <Jobs />
          ) : nav === 'exports' ? (
            <Jobs exports />
          ) : nav === 'settings' ? (
            <Settings />
          ) : nav === 'diagnostics' ? (
            <Diagnostics />
          ) : (
            <>
              <div className="section-heading">
                <h1>{nav === 'details' ? t.details : t.scraper}</h1>
                <span className="badge">{detection?.adapter || 'GENERIC'}</span>
              </div>
              {detection?.candidates.length ? (
                <label className="block">
                  {t.recordSelector}
                  <select
                    value={config.candidateId || detection.candidates[0]?.id}
                    onChange={(e) => {
                      set({ config: { ...config, candidateId: e.target.value } });
                    }}
                  >
                    {detection.candidates.map((candidate) => (
                      <option value={candidate.id} key={candidate.id}>
                        {candidate.label} · {candidate.count} ·{' '}
                        {Math.round(candidate.confidence * 100)}%
                      </option>
                    ))}
                  </select>
                  <small className="muted">
                    {settings.language === 'fa'
                      ? 'پس از تغییر، دوباره «بررسی» را بزنید.'
                      : 'Re-analyze after changing the extraction group.'}
                  </small>
                </label>
              ) : null}
              {detection && detection.candidates.length > 1 && (
                <details>
                  <summary>
                    {settings.language === 'fa'
                      ? 'گروه‌های استخراج هم‌زمان'
                      : 'Multiple extraction groups'}
                  </summary>
                  {detection.candidates.map((c) => (
                    <label className="check" key={c.id}>
                      <input
                        type="checkbox"
                        checked={(config.candidateIds || []).includes(c.id)}
                        onChange={(e) =>
                          set({
                            config: {
                              ...config,
                              candidateIds: e.target.checked
                                ? [...(config.candidateIds || []), c.id]
                                : (config.candidateIds || []).filter((id) => id !== c.id),
                            },
                          })
                        }
                      />
                      {c.label} · {c.count}
                    </label>
                  ))}
                </details>
              )}
              <Preview data={detection} />
              <Scope />
            </>
          )}
          {url && ['scraper', 'images'].includes(nav) && (
            <BranchCapture key={new URL(url).origin} />
          )}
          {analyzeNav && (
            <div className="start-bar">
              <span>
                <strong>{detection?.records.length || 0}</strong> {t.records}
                <br />
                <small>
                  {detection?.images.length || 0} {t.images}
                </small>
              </span>
              <button
                className="primary"
                disabled={busy || !detection || detection.authWall}
                onClick={start}
              >
                {t.start} <span>→</span>
              </button>
            </div>
          )}
        </div>
        <footer className="footer">
          <span>HASHIRA SCRAPER</span>
          <span>{t.build}</span>
        </footer>
      </main>
    </div>
  );
}
