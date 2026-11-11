import { buildTree, type TreeNode } from '../engines/explorer';
import { useUI, command } from '../sidepanel/store';
import { db } from '../storage/db';
import { useLive } from '../sidepanel/useLive';
import { originPattern } from '../security/policy';
import type { Job } from '../types';
import { messages } from '../localization';
export function Explorer() {
  const { detection, config, set, settings } = useUI();
  const t = messages[settings.language];
  const history = useLive(async () => {
    if (!detection) return [];
    const jobs = await db.jobs.orderBy('updatedAt').reverse().toArray();
    const job = jobs.find(
      (j) => j.config.exploreOnly && j.origin === new URL(detection.url).origin,
    );
    return job ? db.snapshots.where('jobId').equals(job.id).toArray() : [];
  }, [detection?.url]);
  if (!detection) return <p className="empty">{t.empty}</p>;
  const links = [...detection.links, ...(history || []).flatMap((p) => p.links)];
  const tree = buildTree(links, detection.url);
  const render = (node: TreeNode) => {
    const selected = config.branches.includes(node.url);
    return (
      <li key={node.url}>
        <label className="tree-item">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) =>
              set({
                config: {
                  ...config,
                  branches: e.target.checked
                    ? [...config.branches, node.url]
                    : config.branches.filter((u) => u !== node.url),
                },
              })
            }
          />
          <span className="node-icon">
            {node.kind === 'category' ? '▰' : node.kind === 'detail' ? '◇' : '↳'}
          </span>
          <span title={node.url}>{node.label}</span>
          <small>{node.kind}</small>
        </label>
        {node.children.length > 0 && <ul>{node.children.map(render)}</ul>}
      </li>
    );
  };
  return (
    <section>
      <h2>{t.explorer}</h2>
      <p className="muted fine">{t.scopeHelp}</p>
      <div className="button-row">
        <button
          className="primary"
          onClick={() => {
            const request = chrome.permissions.request({
              origins: [originPattern(new URL(detection.url).origin)],
            });
            void request
              .then(async (allowed) => {
                if (!allowed) throw new Error('Permission denied');
                const job = await command<Job>('CREATE_JOB', {
                  url: detection.url,
                  name: 'Explore ' + detection.title,
                  config: {
                    ...config,
                    exploreOnly: true,
                    downloadImages: false,
                    downloadDocuments: false,
                    fullCapture: false,
                    apiPaths: [],
                  },
                });
                await command('STATE', { id: job.id, state: 'RUNNING' });
                set({
                  notice:
                    settings.language === 'fa'
                      ? 'کاوش محدود سایت آغاز شد؛ نقشه به‌روزرسانی می‌شود.'
                      : 'Bounded exploration started. The tree updates as pages are checked.',
                });
              })
              .catch((e) => set({ notice: String(e) }));
          }}
        >
          {settings.language === 'fa' ? 'شروع کاوش محدود' : 'Explore bounded pages'}
        </button>
      </div>
      <div className="metrics-strip">
        {links.length} URLs · {config.branches.length} {t.selected}
      </div>
      <ul className="tree">{render(tree)}</ul>
    </section>
  );
}
