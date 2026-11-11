import { selectionFor, cssPath, repeatedSelector } from '../engines/learning/selectors';
export function startSelector(group = 'default', recordCss = '') {
  document.querySelector('[data-hashira-overlay]')?.remove();
  const host = document.createElement('div');
  host.dataset.hashiraOverlay = 'true';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'closed' });
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;border:2px solid #6ee7b7;background:#34d39920;border-radius:4px;pointer-events:none';
  const label = document.createElement('div');
  label.style.cssText =
    'position:fixed;top:12px;left:12px;background:#102a29;color:white;padding:12px 16px;font:13px system-ui;border-radius:8px;max-width:75vw;pointer-events:none';
  label.textContent = 'Hashira · Click to select · Alt+click a parent · Esc to exit';
  shadow.append(box, label);
  document.documentElement.append(host);
  let selected: Element | undefined;
  const cleanup = () => {
    host.remove();
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('click', click, true);
    document.removeEventListener('keydown', key, true);
  };
  const move = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || target === host) return;
    selected = event.altKey ? target.parentElement || target : target;
    if (group === 'record' && !event.altKey) {
      let probe: Element | null = target;
      while (probe && probe !== document.body) {
        if (repeatedSelector(probe).count >= 2 && probe.querySelector('img,h1,h2,h3,h4,a')) {
          selected = probe;
          break;
        }
        probe = probe.parentElement;
      }
    }
    const rect = selected.getBoundingClientRect();
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
  };
  const click = (event: MouseEvent) => {
    if (!selected) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = selectionFor(selected, location.href, group);
    if (recordCss) {
      try {
        const root = selected.closest(recordCss);
        if (root) {
          data.css = root === selected ? ':scope' : cssPath(selected, root);
          data.xpath = undefined as unknown as string;
        }
      } catch {
        /* invalid record selector is shown by the preview */
      }
    }
    void chrome.runtime.sendMessage({ target: 'background', op: 'SELECTION', data });
    cleanup();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') cleanup();
  };
  document.addEventListener('pointermove', move, true);
  document.addEventListener('click', click, true);
  document.addEventListener('keydown', key, true);
}
