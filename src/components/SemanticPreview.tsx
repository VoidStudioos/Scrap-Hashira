import type { SemanticAnalysis } from '../types';
import { useUI } from '../sidepanel/store';
export function SemanticPreview({ data }: { data?: SemanticAnalysis }) {
  const { settings } = useUI();
  const fa = settings.language === 'fa';
  if (!data) return null;
  const counts = Object.fromEntries(
    ['code', 'number', 'price', 'quantity', 'text'].map((kind) => [
      kind,
      data.fields.filter((f) => f.kind === kind).length,
    ]),
  );
  return (
    <details className="semantic-preview">
      <summary>
        {fa ? 'تشخیص خودکار نوع داده و درختواره' : 'Automatic types, categories & clickable images'}
      </summary>
      <div className="metrics-strip">
        {Object.entries(counts).map(([kind, count]) => (
          <span key={kind}>
            {kind}: {count}
          </span>
        ))}
        <span>
          {fa ? 'دسته' : 'categories'}: {data.categories.length}
        </span>
      </div>
      <p className="muted fine">
        {fa
          ? 'کد، عدد، قیمت و متن برای هر دسته در فایل‌های جدا صادر می‌شوند. موارد نامطمئن با اطمینان و دلیل تشخیص نگه داشته می‌شوند.'
          : 'ZIP exports separate codes, numbers and text per category, preserving confidence, raw values and relationships.'}
      </p>
      <h3>{fa ? 'درختواره تشخیص‌داده‌شده' : 'Detected hierarchy'}</h3>
      <ul className="tree">
        {data.categories.slice(0, 100).map((c) => (
          <li key={c.id} style={{ paddingInlineStart: Math.min(c.path.length - 1, 6) * 12 }}>
            <span dir="auto">
              {c.code ? c.code + ' · ' : ''}
              {c.path.join(' / ')}
            </span>
            {c.collapsed && (
              <small>
                {' '}
                ·{' '}
                {fa ? 'بسته؛ فرزندان بارگذاری‌نشده نامشخص' : 'collapsed; unloaded children unknown'}
              </small>
            )}
          </li>
        ))}
      </ul>
      <h3>{fa ? 'فیلدهای تشخیص‌داده‌شده' : 'Typed fields'}</h3>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>{fa ? 'نوع' : 'Type'}</th>
              <th>{fa ? 'مقدار اصلی' : 'Raw value'}</th>
              <th>{fa ? 'برچسب' : 'Label'}</th>
              <th>{fa ? 'اطمینان' : 'Confidence'}</th>
            </tr>
          </thead>
          <tbody>
            {data.fields.slice(0, 60).map((f) => (
              <tr key={f.id} title={f.evidence}>
                <td>{f.kind}</td>
                <td dir="auto">{f.raw}</td>
                <td>{f.label || '—'}</td>
                <td>{Math.round(f.confidence * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>{fa ? 'تصاویر کلیکی' : 'Clickable image targets'}</h3>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>{fa ? 'تصویر کوچک' : 'Thumbnail'}</th>
              <th>{fa ? 'مقصد کلیک' : 'Click target'}</th>
              <th>{fa ? 'رابطه' : 'Relationship'}</th>
            </tr>
          </thead>
          <tbody>
            {data.imageLinks.slice(0, 60).map((l) => (
              <tr key={l.id}>
                <td>
                  {l.thumbnailUrl ? (
                    <a href={l.thumbnailUrl} target="_blank" rel="noopener noreferrer">
                      {fa ? 'نمایش منبع' : 'Open source'}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {l.targetUrl ? (
                    <a
                      href={l.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={l.targetUrl}
                    >
                      {fa ? 'باز کردن مقصد' : 'Open target'}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td title={l.evidence}>{l.relation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
