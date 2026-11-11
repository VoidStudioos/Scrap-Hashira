const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'application/pdf': 'pdf',
};
export const extensionFor = (mime: string) => MIME_EXT[mime] || 'bin';
export function sniffMime(bytes: Uint8Array, header = ''): string | undefined {
  const ascii = (start: number, n: number) => String.fromCharCode(...bytes.slice(start, start + n));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(0, 2) === 'BM') return 'image/bmp';
  if (ascii(4, 4) === 'ftyp' && /avif|avis/.test(ascii(8, 32))) return 'image/avif';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  const text = new TextDecoder().decode(bytes.slice(0, 2048)).trim();
  if ((header.includes('svg') || /<svg[\s>]/i.test(text)) && /<svg[\s>]/i.test(text))
    return 'image/svg+xml';
  return;
}
export async function readBounded(response: Response, maxBytes: number) {
  const length = Number(response.headers.get('content-length'));
  if (length > maxBytes) throw new Error('Resource exceeds configured byte limit');
  if (!response.body) throw new Error('Empty resource body');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Resource exceeds configured byte limit');
      chunks.push(new Uint8Array(value));
    }
  } catch (e) {
    await reader.cancel();
    throw e;
  }
  return new Blob(chunks);
}
export async function verifyImageBlob(
  blob: Blob,
  mime: string,
): Promise<{ width: number; height: number }> {
  if (!mime.startsWith('image/')) return { width: 0, height: 0 };
  if (mime === 'image/svg+xml') {
    const text = await blob.text();
    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (
      xml.querySelector('parsererror') ||
      xml.documentElement.localName !== 'svg' ||
      xml.querySelector('script,foreignObject,animate,set,animateTransform,animateMotion') ||
      [...xml.querySelectorAll('*')].some((el) =>
        [...el.attributes].some(
          (a) =>
            /^on/i.test(a.name) ||
            (a.name === 'style' &&
              (/@import/i.test(a.value) ||
                [...a.value.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].some(
                  (m) => !m[1]!.startsWith('#') && !m[1]!.startsWith('data:image/'),
                ))) ||
            /javascript:/i.test(a.value) ||
            (['href', 'xlink:href'].includes(a.name) && !/^(#|data:image\/)/i.test(a.value)),
        ),
      ) ||
      [...xml.querySelectorAll('style')].some((el) =>
        /@import|url\(\s*["']?(?!#|data:image\/)/i.test(el.textContent || ''),
      )
    )
      throw new Error('Invalid or active SVG is not permitted');
    const root = xml.documentElement;
    const box = (root.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number);
    return {
      width: parseFloat(root.getAttribute('width') || '') || box[2] || 0,
      height: parseFloat(root.getAttribute('height') || '') || box[3] || 0,
    };
  }
  const image = await createImageBitmap(blob);
  const result = { width: image.width, height: image.height };
  image.close();
  if (!result.width || !result.height) throw new Error('Image decode produced no pixels');
  return result;
}
