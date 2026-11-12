import { extensionFor } from '../engines/images/verify';
import { branchFolder } from '../engines/semantics/branch';
import { assertExportReady } from './guard';
import { semanticFiles } from './semantic';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { db } from '../storage/db';
import { csv, flattenRecord } from './format';
import { safeCell, safeFilename } from '../security/policy';
import { errorText } from '../utils/core';
export type ExportFormat = 'json' | 'jsonl' | 'csv' | 'xlsx' | 'zip' | 'html';
function workbook(rows: Record<string, unknown>[]) {
  const safe = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        safeCell(k),
        typeof v === 'number' || typeof v === 'boolean' ? v : safeCell(v),
      ]),
    ),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safe), 'Records');
  return wb;
}
self.onmessage = async (event: MessageEvent<{ jobId: string; format: ExportFormat }>) => {
  const { jobId, format } = event.data;
  try {
    const job = await assertExportReady(jobId);
    const count = await db.records.where('jobId').equals(jobId).count();
    const snapshotCount = await db.snapshots.where('jobId').equals(jobId).count();
    const resources = await db.resources.where('jobId').equals(jobId).toArray();
    const uniqueHashes = [...new Set(resources.flatMap((r) => (r.hash ? [r.hash] : [])))];
    let totalBytes = 0;
    for (const hash of uniqueHashes) {
      const item = await db.blobs.get(hash);
      totalBytes += item?.size || 0;
    }
    if (
      (format === 'zip' && totalBytes * 2 > job.config.memoryMB * 1024 * 1024) ||
      count > 100000 ||
      snapshotCount > 10000
    )
      throw new Error(
        'Export exceeds the configured memory budget. Use streaming JSONL and export a smaller job for ZIP/XLSX.',
      );
    let estimatedTextBytes = 0;
    await db.records
      .where('jobId')
      .equals(jobId)
      .each((row) => {
        estimatedTextBytes += JSON.stringify(row).length * 2;
      });
    await db.snapshots
      .where('jobId')
      .equals(jobId)
      .each((row) => {
        estimatedTextBytes += JSON.stringify(row).length * 2;
      });
    if (
      estimatedTextBytes * (format === 'zip' ? 6 : 3) + (format === 'zip' ? totalBytes * 2 : 0) >
      job.config.memoryMB * 1024 * 1024
    )
      throw new Error(
        'Text and resource export exceed the configured memory budget. Choose streaming JSONL or a smaller job.',
      );
    const records = await db.records.where('jobId').equals(jobId).toArray();
    const rows = records.map(flattenRecord);
    const pages = await db.snapshots.where('jobId').equals(jobId).toArray();
    const logs = await db.logs.where('jobId').equals(jobId).toArray();
    const tables = pages.flatMap((p) => p.tables);
    let blob: Blob;
    let extension: string = format;
    if (format === 'json')
      blob = new Blob(
        [
          JSON.stringify(
            {
              job,
              records,
              tables,
              classification: pages.map((p) => p.semantic).filter(Boolean),
              images: resources,
              pages: pages.map(({ html: _html, ...p }) => p),
              logs,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
    else if (format === 'jsonl')
      blob = new Blob(
        rows.map((r) => JSON.stringify(r) + '\n'),
        { type: 'application/x-ndjson' },
      );
    else if (format === 'csv') blob = new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' });
    else if (format === 'xlsx')
      blob = new Blob(
        [XLSX.write(workbook(rows), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      );
    else {
      const zip = new JSZip();
      const root = zip.folder('hashira-export')!;
      const paths = new Map<string, string>();
      for (const r of resources) {
        if (!r.hash) continue;
        const existing = paths.get(r.hash);
        if (existing) continue;
        const item = await db.blobs.get(r.hash);
        if (!item) continue;
        const ext = extensionFor(item.mime);
        const product = records.find((p) => r.recordIds.includes(p.id));
        const group = safeFilename(
          String(product?.fields.product_code || product?.fields.name || 'unassigned'),
        );
        const folder = r.branchPath?.length ? branchFolder(r.branchPath) + '/' : '';
        const path = `${r.kind === 'image' ? 'images' : r.kind === 'video' ? 'videos' : 'documents'}/${folder}${group}/${r.hash.slice(0, 16)}.${ext}`;
        paths.set(r.hash, path);
        if (format === 'zip') root.file(path, await item.blob.arrayBuffer());
      }
      root.file(
        'manifest.json',
        JSON.stringify(
          {
            version: 1,
            extension: 'Hashira Scraper',
            exportedAt: new Date().toISOString(),
            job,
            counts: {
              records: records.length,
              tables: tables.length,
              pages: pages.length,
              resources: resources.length,
            },
            snapshotPolicy: 'Inert HTML; remote resources and scripts blocked',
            filesInclude:
              'Validated stored bytes, including bytes whose separate Chrome download failed',
          },
          null,
          2,
        ),
      );
      if (format === 'zip') {
        for (const [path, contents] of semanticFiles(pages, records, resources, paths))
          root.file(path, contents);
        root.file('data/products.json', JSON.stringify(records, null, 2));
        root.file('data/products.csv', csv(rows));
        root.file(
          'data/products.xlsx',
          XLSX.write(workbook(rows), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer,
        );
        root.file('data/tables.json', JSON.stringify(tables, null, 2));
        root.file(
          'metadata/images.json',
          JSON.stringify(
            resources.map((r) => ({ ...r, local_path: r.hash ? paths.get(r.hash) : undefined })),
            null,
            2,
          ),
        );
        root.file(
          'metadata/pages.json',
          JSON.stringify(
            pages.map(({ html: _html, ...p }) => p),
            null,
            2,
          ),
        );
        root.file(
          'metadata/errors.json',
          JSON.stringify(
            logs.filter((l) => l.level === 'error'),
            null,
            2,
          ),
        );
        root.file('logs/scraping-log.json', JSON.stringify(logs, null, 2));
      }
      for (let i = 0; i < pages.length; i++)
        if (pages[i]!.html)
          root.file(`pages/page-${String(i + 1).padStart(4, '0')}.html`, pages[i]!.html!);
      blob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 3 },
          streamFiles: true,
        },
        (meta) => self.postMessage({ type: 'progress', percent: meta.percent }),
      );
      extension = 'zip';
    }
    self.postMessage({
      type: 'done',
      blob,
      filename: `hashira-${safeFilename(job.name)}-${jobId.slice(0, 8)}.${extension}`,
    });
  } catch (error) {
    self.postMessage({ type: 'error', message: errorText(error) });
  }
};
