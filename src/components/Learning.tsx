import { useEffect, useState } from 'react';
import type { Profile, SelectorRule } from '../types';
import { db } from '../storage/db';
import { uid } from '../utils/core';
import { command, useUI } from '../sidepanel/store';
import { messages } from '../localization';
import { useLive } from '../sidepanel/useLive';
import { validateProfile } from '../engines/learning';
export function Learning() {
  const { settings, url, tabId, set, config } = useUI();
  const t = messages[settings.language];
  const selections = useLive(() => db.selections.orderBy('at').reverse().limit(20).toArray(), []);
  const profiles = useLive(() => db.profiles.orderBy('updatedAt').reverse().toArray(), []);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState('My extraction');
  const [record, setRecord] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [patterns, setPatterns] = useState('');
  const [fields, setFields] = useState<{ name: string; rule: SelectorRule }[]>([
    { name: 'name', rule: { css: 'h2,h3', transform: 'text' } },
  ]);
  const [fieldName, setFieldName] = useState('');
  useEffect(() => {
    if (url) setPatterns(new URL(url).origin + '/*');
    setEditingId(undefined);
  }, [url]);
  const act = (work: () => Promise<unknown>) => {
    void work()
      .then(() => set({ notice: settings.language === 'fa' ? 'انجام شد' : 'Saved' }))
      .catch((e) => set({ notice: String(e) }));
  };
  const save = async () => {
    if (!url) throw new Error('Analyze a page first');
    const previous = editingId ? await db.profiles.get(editingId) : undefined;
    if (previous && previous.origin !== new URL(url).origin)
      throw new Error('Select a profile for the current origin');
    const profile: Profile = {
      id: previous?.id || uid(),
      name,
      origin: new URL(url).origin,
      patterns: patterns.split('\n').filter(Boolean),
      pageType: 'custom',
      record: { css: record, fingerprint: fingerprint || undefined },
      fields: Object.fromEntries(fields.map((f) => [f.name, f.rule])),
      successes: previous?.successes || 0,
      failures: previous?.failures || 0,
      confidence: previous?.confidence || 0.5,
      history: previous?.history || [],
      updatedAt: Date.now(),
    };
    await command('PROFILE', { profile });
    setEditingId(profile.id);
    set({
      config: {
        ...config,
        profileId: profile.id,
        profileIds: [...new Set([...(config.profileIds || []), profile.id])],
      },
    });
  };
  return (
    <section>
      <h2>{t.learning}</h2>
      <button
        onClick={() => {
          setEditingId(undefined);
          setName('My extraction');
          setRecord('');
          setFingerprint('');
          setFields([{ name: 'name', rule: { css: 'h2,h3', transform: 'text' } }]);
        }}
      >
        {settings.language === 'fa' ? 'پروفایل جدید' : 'New profile'}
      </button>
      <p className="muted fine">
        {settings.language === 'fa'
          ? 'قواعد از اصلاحات شما ذخیره و اعتبارسنجی می‌شوند. این قابلیت یادگیری ماشین نیست.'
          : 'Deterministic profiles learn from your corrections and validate selectors on revisit.'}
      </p>
      <div className="two-inputs">
        <label>
          {t.name}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t.recordSelector}
          <input
            dir="ltr"
            value={record}
            onChange={(e) => {
              setRecord(e.target.value);
              setFingerprint('');
            }}
          />
        </label>
      </div>
      <label className="block">
        {t.pattern}
        <textarea dir="ltr" value={patterns} onChange={(e) => setPatterns(e.target.value)} />
      </label>
      <h3>{t.fieldRules}</h3>
      {fields.map((field, i) => (
        <div className="rule-row" key={i}>
          <input
            aria-label="Field name"
            value={field.name}
            onChange={(e) =>
              setFields(fields.map((f, n) => (n === i ? { ...f, name: e.target.value } : f)))
            }
          />
          <input
            aria-label="Field CSS selector"
            placeholder="CSS relative to record"
            dir="ltr"
            value={field.rule.css}
            onChange={(e) =>
              setFields(
                fields.map((f, n) =>
                  n === i ? { ...f, rule: { ...f.rule, css: e.target.value } } : f,
                ),
              )
            }
          />
          <input
            aria-label="Attribute"
            placeholder="attribute"
            value={field.rule.attribute || ''}
            onChange={(e) =>
              setFields(
                fields.map((f, n) =>
                  n === i
                    ? { ...f, rule: { ...f.rule, attribute: e.target.value || undefined } }
                    : f,
                ),
              )
            }
          />
          <select
            aria-label="Transform"
            value={field.rule.transform || 'text'}
            onChange={(e) =>
              setFields(
                fields.map((f, n) =>
                  n === i
                    ? {
                        ...f,
                        rule: { ...f.rule, transform: e.target.value as SelectorRule['transform'] },
                      }
                    : f,
                ),
              )
            }
          >
            {['text', 'price', 'code', 'url'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            className="icon-button"
            aria-label="Remove field"
            onClick={() => setFields(fields.filter((_, n) => n !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <div className="button-row">
        <button
          onClick={() =>
            setFields([
              ...fields,
              { name: 'field_' + (fields.length + 1), rule: { css: '', transform: 'text' } },
            ])
          }
        >
          {t.newField}
        </button>
        <button className="primary" onClick={() => act(save)}>
          {t.save}
        </button>
        <button
          onClick={() => {
            set({
              config: { ...config, profileId: undefined, profileIds: [] },
              notice:
                settings.language === 'fa' ? 'تشخیص عمومی انتخاب شد' : 'Generic detection selected',
            });
          }}
        >
          Generic
        </button>
      </div>
      <hr />
      <h3>{t.selector}</h3>
      <div className="button-row">
        <input
          placeholder={t.field}
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
        />
        <button
          disabled={!tabId}
          onClick={() =>
            act(() =>
              command('SELECT', {
                tabId,
                group: fieldName || 'record',
                recordCss: fieldName ? record : '',
              }),
            )
          }
        >
          {t.select}
        </button>
      </div>
      <p className="muted fine">
        {settings.language === 'fa'
          ? 'رکورد را انتخاب کنید؛ سپس فیلدها را با سلکتور نسبی تعریف کنید. Alt برای انتخاب والد و Esc برای خروج.'
          : 'Select a record, then enter field selectors relative to it. Alt selects a parent; Esc exits.'}
      </p>
      {selections
        ?.filter((s) => url && new URL(s.url).origin === new URL(url).origin)
        .map((s) => (
          <div className="selection-card" key={s.id}>
            <code dir="ltr">{s.css}</code>
            <p>{s.text.slice(0, 100)}</p>
            <div className="button-row">
              <button
                onClick={() => {
                  setRecord(s.repeated);
                  setFingerprint(s.fingerprint);
                }}
              >
                {t.record} ×{s.count}
              </button>
              <button
                onClick={() => {
                  const key = s.group === 'record' ? 'field_' + (fields.length + 1) : s.group;
                  setFields([
                    ...fields,
                    {
                      name: key,
                      rule: {
                        css: s.css,
                        xpath: s.xpath,
                        attribute: s.attribute,
                        semantic: s.semantic,
                        transform: s.attribute === 'href' ? 'url' : 'text',
                      },
                    },
                  ]);
                }}
              >
                {t.field}
              </button>
            </div>
            <details>
              <summary>XPath</summary>
              <code>{s.xpath}</code>
            </details>
          </div>
        ))}
      <hr />
      <h3>{t.profile}</h3>
      {profiles
        ?.filter((p) => !url || p.origin === new URL(url).origin)
        .map((p) => (
          <div className="profile-card" key={p.id}>
            <label className="check">
              <input
                type="checkbox"
                checked={(config.profileIds || []).includes(p.id)}
                onChange={(e) =>
                  set({
                    config: {
                      ...config,
                      profileIds: e.target.checked
                        ? [...(config.profileIds || []), p.id]
                        : (config.profileIds || []).filter((id) => id !== p.id),
                    },
                  })
                }
              />
              <strong>{p.name}</strong>
            </label>
            <small>
              {p.origin} · {Math.round(p.confidence * 100)}% · {p.successes}/
              {p.successes + p.failures}
            </small>
            <div className="button-row">
              <button
                onClick={() => {
                  setEditingId(p.id);
                  setName(p.name);
                  setRecord(p.record.css);
                  setFingerprint(p.record.fingerprint || '');
                  setFields(Object.entries(p.fields).map(([name, rule]) => ({ name, rule })));
                  setPatterns(p.patterns.join('\n'));
                  set({ config: { ...config, profileId: p.id, profileIds: [p.id] } });
                }}
              >
                {t.profile}
              </button>
              <button onClick={() => act(() => db.profiles.delete(p.id))}>{t.remove}</button>
            </div>
          </div>
        ))}
      <div className="button-row">
        <button
          onClick={() =>
            act(async () => {
              const blob = new Blob([JSON.stringify(profiles, null, 2)], {
                type: 'application/json',
              });
              const u = URL.createObjectURL(blob);
              await chrome.downloads.download({
                url: u,
                filename: 'hashira-profiles.json',
                saveAs: true,
              });
              setTimeout(() => URL.revokeObjectURL(u), 60000);
            })
          }
        >
          {t.downloadProfiles}
        </button>
        <label className="file-button">
          {t.import}
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                act(async () => {
                  if (file.size > 2_000_000) throw new Error('Profile file exceeds 2 MB');
                  const input: unknown = JSON.parse(await file.text());
                  if (!Array.isArray(input) || input.length > 200)
                    throw new Error('Expected up to 200 profiles');
                  const valid = input.map(validateProfile);
                  await db.profiles.bulkPut(valid);
                });
            }}
          />
        </label>
      </div>
    </section>
  );
}
