import { verifyImageBlob } from '../engines/images/verify';
import { db } from '../storage/db';
import { errorText } from '../utils/core';
const urls = new Map<string, string>();
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id || msg.target !== 'offscreen') return;
  const run = async () => {
    if (msg.op === 'REVOKE') {
      const url = urls.get(msg.id);
      if (url) URL.revokeObjectURL(url);
      urls.delete(msg.id);
      return true;
    }
    const data = await db.blobs.get(String(msg.hash));
    if (!data) throw new Error('Resource bytes are missing from local storage');
    if (msg.op === 'URL') {
      const old = urls.get(msg.id);
      if (old) URL.revokeObjectURL(old);
      const url = URL.createObjectURL(data.blob);
      urls.set(msg.id, url);
      return url;
    }
    if (msg.op === 'VERIFY') return verifyImageBlob(data.blob, data.mime);
    throw new Error('Unknown resource processor operation');
  };
  void run()
    .then((data) => respond({ ok: true, data }))
    .catch((error) => respond({ ok: false, error: errorText(error) }));
  return true;
});
