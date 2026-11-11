import { useEffect, useState } from 'react';
import { useUI, saveSettings } from '../sidepanel/store';
import { messages } from '../localization';
import { Scope } from './Scope';
export function Settings() {
  const { settings, config, set } = useUI();
  const t = messages[settings.language];
  const [origins, setOrigins] = useState<string[]>([]);
  useEffect(() => {
    void chrome.permissions.getAll().then((p) => setOrigins(p.origins || []));
  }, []);
  return (
    <section>
      <h2>{t.settings}</h2>
      <div className="two-inputs">
        <label>
          {t.language}
          <select
            value={settings.language}
            onChange={(e) => {
              void saveSettings({ ...settings, language: e.target.value as 'en' | 'fa' });
            }}
          >
            <option value="en">English</option>
            <option value="fa">فارسی</option>
          </select>
        </label>
        <label>
          {t.theme}
          <select
            value={settings.theme}
            onChange={(e) => {
              void saveSettings({ ...settings, theme: e.target.value as 'dark' | 'light' });
            }}
          >
            <option value="dark">Dark / تاریک</option>
            <option value="light">Light / روشن</option>
          </select>
        </label>
      </div>
      <Scope />
      <button
        className="primary"
        onClick={() => {
          void saveSettings({ ...settings, config }).then(() =>
            set({ notice: settings.language === 'fa' ? 'تنظیمات ذخیره شد' : 'Defaults saved' }),
          );
        }}
      >
        {settings.language === 'fa' ? 'ذخیره تنظیمات پیش‌فرض' : 'Save defaults'}
      </button>
      <h3>{t.permission}</h3>
      <p className="muted fine">{t.permissionHelp}</p>
      {origins.map((origin) => (
        <div className="origin-request" key={origin}>
          <code>{origin}</code>
          <button
            onClick={() => {
              void chrome.permissions
                .remove({ origins: [origin] })
                .then(() => setOrigins(origins.filter((o) => o !== origin)));
            }}
          >
            {t.remove}
          </button>
        </div>
      ))}
      <hr />
      <p className="muted">{t.build}</p>
    </section>
  );
}
