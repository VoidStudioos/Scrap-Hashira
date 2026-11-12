import type { VideoCandidate } from '../../types';
import { webUrl } from '../../security/policy';
export function discoverVideos(document: Document, base: string): VideoCandidate[] {
  const found = new Map<string, VideoCandidate>();
  const add = (raw: string | null, label: string, source: string) => {
    if (!raw) return;
    const url = /^(blob:|data:video\/)/i.test(raw) ? raw : webUrl(raw, base);
    if (!url) return;
    const limitation = url.startsWith('blob:')
      ? 'Page-local blob / MediaSource: a direct media URL is required.'
      : /\.(m3u8|mpd)(?:[?#]|$)/i.test(url)
        ? 'Streaming playlist: segmented / protected streams are not assembled.'
        : undefined;
    found.set(url, { url, label, source, downloadable: !limitation, limitation });
  };
  for (const video of document.querySelectorAll('video')) {
    const label = video.getAttribute('aria-label') || video.title || 'Video';
    add(video.currentSrc || video.getAttribute('src'), label, 'video');
    for (const source of video.querySelectorAll('source')) add(source.src, label, 'source');
  }
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    if (/\.(mp4|m4v|mov|webm|mkv|avi|ogv|m3u8|mpd)(?:[?#]|$)/i.test(a.href))
      add(a.href, a.textContent?.trim() || 'Video link', 'link');
  for (const meta of document.querySelectorAll(
    'meta[property="og:video"],meta[property="og:video:url"],meta[property="og:video:secure_url"]',
  ))
    add(meta.getAttribute('content'), document.title, 'metadata');
  return [...found.values()];
}
