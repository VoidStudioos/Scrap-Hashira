import { assertExportReady } from './guard';
import type { ExportFormat } from './worker';
import { db } from '../storage/db';
import { flattenRecord } from './format';
interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: unknown) => Promise<{
    createWritable: () => Promise<{
      write: (value: string) => Promise<void>;
      close: () => Promise<void>;
      abort: () => Promise<void>;
    }>;
  }>;
}
export async function streamingJSONL(jobId: string) {
  await assertExportReady(jobId);
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker)
    throw new Error('File System Access is unavailable. Use JSONL export for a bounded job.');
  const handle = await picker.call(window, {
    suggestedName: 'hashira-records.jsonl',
    types: [{ description: 'JSON Lines', accept: { 'application/x-ndjson': ['.jsonl'] } }],
  });
  const output = await handle.createWritable();
  try {
    let offset = 0;
    while (true) {
      const batch = await db.records
        .where('jobId')
        .equals(jobId)
        .offset(offset)
        .limit(250)
        .toArray();
      if (!batch.length) break;
      await output.write(batch.map((r) => JSON.stringify(flattenRecord(r)) + '\n').join(''));
      offset += batch.length;
    }
    await output.close();
  } catch (e) {
    await output.abort();
    throw e;
  }
}
export function exportJob(jobId: string, format: ExportFormat, onProgress: (n: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.onmessage = (event) => {
      if (event.data.type === 'progress') onProgress(event.data.percent);
      if (event.data.type === 'error') {
        worker.terminate();
        reject(new Error(event.data.message));
      }
      if (event.data.type === 'done') {
        const { blob, filename } = event.data as { blob: Blob; filename: string };
        const url = URL.createObjectURL(blob);
        chrome.downloads
          .download({ url, filename, saveAs: true })
          .then((id) => {
            const done = (delta: chrome.downloads.DownloadDelta) => {
              if (delta.id !== id || !delta.state) return;
              if (['complete', 'interrupted'].includes(delta.state.current || '')) {
                URL.revokeObjectURL(url);
                chrome.downloads.onChanged.removeListener(done);
                worker.terminate();
                if (delta.state.current === 'complete') resolve(filename);
                else reject(new Error('Export download interrupted'));
              }
            };
            chrome.downloads.onChanged.addListener(done);
            return chrome.downloads.search({ id }).then((found) => {
              if (found[0] && ['complete', 'interrupted'].includes(found[0].state))
                done({ id, state: { current: found[0].state } });
            });
          })
          .catch((error) => {
            URL.revokeObjectURL(url);
            worker.terminate();
            reject(error);
          });
      }
    };
    worker.postMessage({ jobId, format });
  });
}
