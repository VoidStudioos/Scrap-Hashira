import { useUI } from '../sidepanel/store';
import { messages } from '../localization';
export function Tables() {
  const { settings, detection } = useUI();
  const t = messages[settings.language];
  return (
    <section>
      <h2>{t.tables}</h2>
      {!detection && <p className="empty">{t.empty}</p>}
      {detection?.tables.map((table) => (
        <div className="table-card" key={table.id}>
          <h3>
            {table.caption}{' '}
            <span className="badge">
              {table.rows.length} × {table.headers.length}
            </span>
          </h3>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  {table.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 100).map((r, i) => (
                  <tr key={i}>
                    {r.map((c, n) => (
                      <td key={n}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Raw HTML</summary>
            <pre>{table.raw}</pre>
          </details>
        </div>
      ))}
    </section>
  );
}
