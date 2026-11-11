import { SemanticPreview } from './SemanticPreview';
import type { Detection } from '../types';
import { useUI } from '../sidepanel/store';
import { messages } from '../localization';
export function Preview({ data }: { data?: Detection }) {
  const { settings } = useUI();
  const t = messages[settings.language];
  if (!data)
    return (
      <div className="empty">
        <div className="empty-grid">▦</div>
        <h3>{t.ready}</h3>
        <p>{t.empty}</p>
      </div>
    );
  const fields = [...new Set(data.records.flatMap((r) => Object.keys(r.fields)))].slice(0, 12);
  return (
    <section>
      <div className="section-heading">
        <h2>{t.preview}</h2>
        <span className="badge">{data.adapter}</span>
      </div>
      <div className="metrics-strip">
        <span>
          {data.records.length} {t.records}
        </span>
        <span>
          {data.tables.length} {t.tables}
        </span>
        <span>
          {data.images.length} {t.images}
        </span>
      </div>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              {fields.map((f) => (
                <th key={f}>{f}</th>
              ))}
              <th>{t.confidence}</th>
            </tr>
          </thead>
          <tbody>
            {data.records.slice(0, 50).map((r, i) => (
              <tr key={r.id + '_' + i}>
                <td className="muted">{i + 1}</td>
                {fields.map((f) => (
                  <td key={f} title={String(r.fields[f] ?? '')}>
                    {typeof r.fields[f] === 'object'
                      ? JSON.stringify(r.fields[f])
                      : String(r.fields[f] ?? '—')}
                  </td>
                ))}
                <td>
                  <span className="confidence">{Math.round(r.confidence * 100)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SemanticPreview data={data.semantic} />
      {data.records.length > 50 && <p className="muted fine">{t.limit}</p>}
      {data.warnings.map((w, i) => (
        <div key={i} className="warning">
          {w}
        </div>
      ))}
    </section>
  );
}
