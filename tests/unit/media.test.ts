import { describe, expect, it } from 'vitest';
import { discoverVideos } from '../../src/engines/images/video';
import { extensionFor, sniffMime, signatureOnly } from '../../src/engines/images/verify';
import { validateConfig } from '../../src/security/policy';
import { detect } from '../../src/engines/detection';
const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
describe('media discovery and byte identity', () => {
  it('uses bytes over misleading headers and filenames', () => {
    expect(sniffMime(bytes('GIF89a'), 'image/jpeg')).toBe('image/gif');
    expect(extensionFor(sniffMime(bytes('GIF89a'))!)).toBe('gif');
    expect(sniffMime(bytes('<html>login</html>'), 'video/mp4')).toBeUndefined();
  });
  it.each([
    ['\0\0\0\x18ftypisom\0\0\0\0mp42', 'video/mp4', 'mp4'],
    ['\0\0\0\x18ftypqt  \0\0\0\0', 'video/quicktime', 'mov'],
    ['\0\0\0\x18ftypheic\0\0\0\0mif1', 'image/heic', 'heic'],
    ['\0\0\0\x18ftypavif\0\0\0\0mif1', 'image/avif', 'avif'],
    ['RIFF\0\0\0\0AVI ', 'video/x-msvideo', 'avi'],
    ['\x1a\x45\xdf\xa3webm', 'video/webm', 'webm'],
    ['II\x2a\0', 'image/tiff', 'tiff'],
  ])('recognizes %s', (raw, mime, ext) => {
    expect(sniffMime(bytes(raw))).toBe(mime);
    expect(extensionFor(mime)).toBe(ext);
  });
  it('reports unresolvable streams instead of scheduling false downloads', () => {
    document.body.innerHTML =
      '<video src="/asset?id=7"></video><video src="blob:https://example.test/local"></video><a href="/live.m3u8">Live</a><a href="/clip.mp4">Clip</a>';
    const items = discoverVideos(document, 'https://example.test/catalog');
    expect(items.filter((v) => v.downloadable)).toHaveLength(2);
    expect(items.filter((v) => v.limitation)).toHaveLength(2);
    expect(detect(document, 'https://example.test/catalog').videos).toHaveLength(4);
  });
  it('bounds video queue and explicitly distinguishes signature-only validation', () => {
    expect(validateConfig({ maxVideos: 99999 }).maxVideos).toBe(1000);
    expect(signatureOnly('image/heic')).toBe(true);
    expect(signatureOnly('video/mp4')).toBe(true);
    expect(signatureOnly('image/gif')).toBe(false);
  });
});
