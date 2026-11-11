import { useState } from 'react';
import { originPattern } from '../security/policy';
import { command, useUI } from '../sidepanel/store';

interface CaptureResult {
  jobId: string;
  records: number;
  images: number;
  warnings: string[];
}

export function BranchCapture() {
  const { url, tabId, config, busy, set, settings } = useUI();
  const [path, setPath] = useState('');
  const fa = settings.language === 'fa';
  const origin = new URL(url).origin;
  const sessionKey = 'branch-capture:' + origin;
  const capture = async () => {
    set({ busy: true, notice: '' });
    try {
      if (!(await chrome.permissions.request({ origins: [originPattern(origin)] })))
        throw new Error(fa ? 'دسترسی سایت داده نشد.' : 'Site permission denied.');
      const saved = await chrome.storage.local.get(sessionKey);
      const result = await command<CaptureResult>('CAPTURE_BRANCH', {
        tabId,
        url,
        path,
        config,
        jobId: saved[sessionKey],
      });
      await chrome.storage.local.set({ [sessionKey]: result.jobId });
      set({
        notice:
          (fa
            ? 'شاخه ثبت شد. رکوردهای یافت‌شده: ' +
              result.records +
              '، تصویرهای یافت‌شده: ' +
              result.images
            : 'Branch captured. Records found: ' +
              result.records +
              ', images found: ' +
              result.images) + (result.warnings.length ? ' ' + result.warnings.join(' ') : ''),
      });
    } catch (error) {
      set({ notice: String(error) });
    } finally {
      set({ busy: false });
    }
  };
  return (
    <section className="card">
      <h2>{fa ? 'ثبت شاخهٔ باز' : 'Capture open branch'}</h2>
      <p className="muted">
        {fa
          ? 'شاخه را در سایت باز کنید و مسیرش را بنویسید. شاخه‌های بعدی همین سایت به همان کار اضافه می‌شوند. برای تصویر بزرگ‌شده، ابتدا آن را در صفحه باز کنید.'
          : 'Open a branch on the site and enter its path. Further branches from this site are added to the same job. Open an enlarged image in the page before capturing it.'}
      </p>
      <label className="block">
        {fa ? 'مسیر شاخه' : 'Branch path'}
        <input
          value={path}
          maxLength={600}
          placeholder={fa ? 'محصولات دنا / موتور / روغن‌کاری' : 'Vehicles / Engine / Lubrication'}
          onChange={(event) => setPath(event.target.value)}
        />
      </label>
      <div className="start-bar">
        <button
          className="primary"
          disabled={busy || !tabId || !path.trim()}
          onClick={() => void capture()}
        >
          {fa ? 'ثبت شاخه و دریافت عکس‌ها' : 'Capture branch and download images'}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            void chrome.storage.local
              .remove(sessionKey)
              .then(() => {
                setPath('');
                set({
                  notice: fa
                    ? 'ثبت بعدی در کار جدید ذخیره می‌شود.'
                    : 'The next capture starts a new job.',
                });
              })
              .catch((error) => set({ notice: String(error) }));
          }}
        >
          {fa ? 'کار جدید' : 'New job'}
        </button>
      </div>
    </section>
  );
}
