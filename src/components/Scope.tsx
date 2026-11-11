import { useUI } from '../sidepanel/store';
import { messages } from '../localization';
import type { CrawlConfig } from '../types';
export function Scope() {
  const { config, set, settings, url } = useUI();
  const t = messages[settings.language];
  const change = (key: keyof CrawlConfig, value: unknown) =>
    set({ config: { ...config, [key]: value, performance: 'CUSTOM' } });
  const fields: { key: keyof CrawlConfig; label: string; min: number; max: number }[] = [
    {
      key: 'maxPages',
      label: settings.language === 'fa' ? 'حداکثر صفحات' : 'Max pages',
      min: 1,
      max: 10000,
    },
    {
      key: 'maxDepth',
      label: settings.language === 'fa' ? 'عمق خزش' : 'Max depth',
      min: 0,
      max: 15,
    },
    {
      key: 'maxImages',
      label: settings.language === 'fa' ? 'حداکثر تصاویر' : 'Max images',
      min: 0,
      max: 50000,
    },
    {
      key: 'delayMs',
      label: settings.language === 'fa' ? 'فاصله درخواست (ms)' : 'Request delay (ms)',
      min: 250,
      max: 60000,
    },
    {
      key: 'pageConcurrency',
      label: settings.language === 'fa' ? 'صفحات هم‌زمان' : 'Concurrent pages',
      min: 1,
      max: 3,
    },
    {
      key: 'downloadConcurrency',
      label: settings.language === 'fa' ? 'دانلود هم‌زمان' : 'Concurrent downloads',
      min: 1,
      max: 8,
    },
    {
      key: 'scrollSteps',
      label: settings.language === 'fa' ? 'گام‌های اسکرول' : 'Scroll steps',
      min: 0,
      max: 30,
    },
    {
      key: 'loadMoreClicks',
      label: settings.language === 'fa' ? 'کلیک نمایش بیشتر' : 'Load More clicks',
      min: 0,
      max: 20,
    },
    {
      key: 'retries',
      label: settings.language === 'fa' ? 'تعداد تلاش مجدد' : 'Retries',
      min: 0,
      max: 5,
    },
    {
      key: 'timeoutMs',
      label: settings.language === 'fa' ? 'مهلت (ms)' : 'Timeout (ms)',
      min: 3000,
      max: 25000,
    },
    {
      key: 'memoryMB',
      label: settings.language === 'fa' ? 'بودجه حافظه (MB)' : 'Memory budget (MB)',
      min: 64,
      max: 1024,
    },
    {
      key: 'maxResourceMB',
      label: settings.language === 'fa' ? 'سقف هر فایل (MB)' : 'Max resource (MB)',
      min: 1,
      max: 100,
    },
  ];
  return (
    <section className="scope">
      <div className="section-heading">
        <h2>{t.scope}</h2>
        <span className="badge">{url ? new URL(url).hostname : '—'}</span>
      </div>
      <p className="muted fine">{t.scopeHelp}</p>
      <div className="preset-row">
        {(['SAFE', 'BALANCED', 'FAST', 'CUSTOM'] as const).map((mode) => (
          <button
            key={mode}
            className={config.performance === mode ? 'selected compact' : 'compact'}
            onClick={() => {
              const preset =
                mode === 'SAFE'
                  ? { pageConcurrency: 1, downloadConcurrency: 1, delayMs: 2500 }
                  : mode === 'FAST'
                    ? { pageConcurrency: 3, downloadConcurrency: 6, delayMs: 700 }
                    : mode === 'BALANCED'
                      ? { pageConcurrency: 1, downloadConcurrency: 3, delayMs: 1200 }
                      : {};
              set({ config: { ...config, ...preset, performance: mode } });
            }}
          >
            {mode}
          </button>
        ))}
      </div>
      <label className="block">
        {settings.language === 'fa' ? 'نوع پیمایش' : 'Traversal mode'}
        <select
          value={config.traverse || 'all'}
          onChange={(e) => change('traverse', e.target.value)}
        >
          {[
            ['all', 'All in-scope pages / همه صفحات مجاز'],
            ['details', 'Details and pagination / جزئیات و صفحه‌بندی'],
            ['pagination', 'Pagination only / فقط صفحه‌بندی'],
            ['categories', 'Categories and listings / دسته‌ها و فهرست‌ها'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-grid">
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              type="number"
              min={f.min}
              max={f.max}
              value={Number(config[f.key])}
              onChange={(e) => change(f.key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <div className="switches">
        {(['downloadImages', 'downloadDocuments', 'fullCapture'] as const).map((key) => (
          <label className="check" key={key}>
            <input
              type="checkbox"
              checked={config[key]}
              onChange={(e) => change(key, e.target.checked)}
            />
            {key === 'downloadImages'
              ? t.images
              : key === 'fullCapture'
                ? t.full
                : settings.language === 'fa'
                  ? 'اسناد PDF مجاز'
                  : 'Accessible PDF documents'}
          </label>
        ))}
      </div>
      <details>
        <summary>{settings.language === 'fa' ? 'فیلترهای URL و API' : 'URL filters & API'}</summary>
        {(['include', 'exclude', 'apiPaths'] as const).map((key) => (
          <label className="block" key={key}>
            {key === 'apiPaths' ? t.api : t[key]}
            <textarea
              dir="ltr"
              value={config[key].join('\n')}
              placeholder={
                key === 'apiPaths'
                  ? '/api/products'
                  : key === 'include'
                    ? 'https://example.com/catalog/*'
                    : '*logout*'
              }
              onChange={(e) =>
                change(
                  key,
                  e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
        ))}
      </details>
    </section>
  );
}
