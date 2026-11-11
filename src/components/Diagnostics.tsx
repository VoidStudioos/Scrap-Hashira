import { useUI } from '../sidepanel/store';
import { messages } from '../localization';
import { db } from '../storage/db';
import { useLive } from '../sidepanel/useLive';
export function Diagnostics() {
  const { settings } = useUI();
  const t = messages[settings.language];
  const logs = useLive(() => db.logs.orderBy('at').reverse().limit(200).toArray(), []);
  return (
    <section>
      <h2>{t.diagnostics}</h2>
      {!logs?.length && <p className="empty">{t.emptyLogs}</p>}
      {logs?.map((log) => (
        <div className={'log ' + log.level} key={log.id}>
          <div>
            <span className="badge">{log.code}</span>
            <time>{new Date(log.at).toLocaleTimeString()}</time>
          </div>
          <p>{log.message}</p>
          {log.url && <code>{log.url}</code>}
        </div>
      ))}
    </section>
  );
}
