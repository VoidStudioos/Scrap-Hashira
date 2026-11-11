import { globMatch } from '../../security/policy';
export function robotsAllows(text: string, url: string): boolean {
  const path = new URL(url).pathname + new URL(url).search;
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let group = { agents: [] as string[], rules: [] as { allow: boolean; path: string }[] };
  let hasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase(),
      value = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (hasRules) {
        groups.push(group);
        group = { agents: [], rules: [] };
        hasRules = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (['allow', 'disallow'].includes(key) && value) {
      group.rules.push({ allow: key === 'allow', path: value });
      hasRules = true;
    }
  }
  groups.push(group);
  const exact = groups.filter((g) =>
    g.agents.some((a) => a !== '*' && 'hashirascraper'.includes(a)),
  );
  const selected = exact.length ? exact : groups.filter((g) => g.agents.includes('*'));
  const rules = selected
    .flatMap((g) => g.rules)
    .filter((r) => globMatch(path, r.path.endsWith('$') ? r.path.slice(0, -1) : r.path + '*'))
    .sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}
export function retryAfter(value: string | null, now = Date.now()): number {
  if (!value) return 30000;
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? Math.max(1000, seconds * 1000)
    : Math.max(1000, Date.parse(value) - now || 30000);
}
export function retryDelay(attempt: number) {
  return Math.min(120000, 1000 * 2 ** attempt);
}
