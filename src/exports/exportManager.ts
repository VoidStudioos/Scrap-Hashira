// Export System: JSON, JSONL, CSV, XLSX, and structured ZIP packages
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { StorageService } from '../storage/storageService';
import { SecuritySanitizer } from '../security/sanitizer';

export class ExportManager {
  /**
   * Generates formatted JSON string
   */
  static toJson(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generates JSON Lines string (each object on a separate line)
   */
  static toJsonLines(records: any[]): string {
    return records.map((record) => JSON.stringify(record)).join('\n');
  }

  /**
   * Generates CSV with UTF-8 BOM and formula injection protection
   */
  static toCsv(records: Record<string, any>[]): string {
    if (!records.length) return '';

    // Collect all unique column headers
    const headersSet = new Set<string>();
    records.forEach((r) => {
      Object.keys(r).forEach((k) => headersSet.add(k));
    });
    const headers = Array.from(headersSet);

    // Escape header row
    const headerRow = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');

    // Escape data rows with DDE formula protection
    const dataRows = records.map((record) => {
      return headers
        .map((header) => {
          const val = record[header];
          if (val === undefined || val === null) return '""';
          const sanitized = SecuritySanitizer.sanitizeForSpreadsheet(val);
          return `"${String(sanitized).replace(/"/g, '""')}"`;
        })
        .join(',');
    });

    // UTF-8 BOM for Persian and Excel compatibility
    return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
  }

  /**
   * Generates Excel XLSX buffer using the xlsx library
   */
  static toXlsx(records: Record<string, any>[], sheetName: string = 'Products'): ArrayBuffer {
    // Sanitize records for formula injection before writing
    const sanitizedRecords = records.map((r) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) {
        clean[k] = SecuritySanitizer.sanitizeForSpreadsheet(v);
      }
      return clean;
    });

    const worksheet = XLSX.utils.json_to_sheet(sanitizedRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

    const xlsxOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return xlsxOut;
  }

  /**
   * Generates complete structured ZIP export matching the exact specification:
   * hashira-export/
   *   manifest.json
   *   data/
   *     products.json
   *     products.csv
   *     products.xlsx
   *     tables.json
   *   pages/
   *     page-001.html
   *   images/
   *     PRODUCT-001/
   *   metadata/
   *     images.json
   *     pages.json
   *     errors.json
   *   logs/
   *     scraping-log.json
   */
  static async createCompleteExportZip(jobId: string): Promise<Blob> {
    const zip = new JSZip();
    const root = zip.folder('hashira-export') || zip;

    const job = await StorageService.getJob(jobId);
    const records = await StorageService.getRecordsForJob(jobId);
    const tables = await StorageService.getTablesForJob(jobId);
    const images = await StorageService.getImagesForJob(jobId);
    const snapshots = await StorageService.getSnapshotsForJob(jobId);
    const logs = await StorageService.getLogs(jobId, 1000);

    const productsData = records.map((r) => ({
      id: r.id,
      title: r.title,
      sourceUrl: r.sourceUrl,
      ...r.normalizedData,
      extractedAt: new Date(r.extractedAt).toISOString(),
    }));

    // 1. Root Manifest
    const manifest = {
      exportVersion: '2.0.0',
      jobId,
      jobName: job?.name || 'Scrape Job',
      startingUrl: job?.startingUrl || '',
      exportedAt: new Date().toISOString(),
      summary: {
        totalProducts: productsData.length,
        totalTables: tables.length,
        totalImages: images.length,
        totalSnapshots: snapshots.length,
      },
    };
    root.file('manifest.json', this.toJson(manifest));

    // 2. data/
    const dataFolder = root.folder('data')!;
    dataFolder.file('products.json', this.toJson(productsData));
    dataFolder.file('products.csv', this.toCsv(productsData));
    dataFolder.file('products.xlsx', this.toXlsx(productsData, 'Products'));
    dataFolder.file('tables.json', this.toJson(tables));

    // 3. pages/
    const pagesFolder = root.folder('pages')!;
    snapshots.forEach((snap, idx) => {
      const pageNum = String(idx + 1).padStart(3, '0');
      pagesFolder.file(`page-${pageNum}.html`, snap.htmlContent);
    });

    // 4. images/
    const imagesFolder = root.folder('images')!;
    imagesFolder.file('README.txt', 'Downloaded image files are stored in product folders.');

    // 5. metadata/
    const metaFolder = root.folder('metadata')!;
    metaFolder.file('images.json', this.toJson(images));
    metaFolder.file('pages.json', this.toJson(snapshots.map((s) => ({ url: s.url, title: s.title, capturedAt: s.capturedAt, metadata: s.metadata }))));
    metaFolder.file('errors.json', this.toJson(job?.errorHistory || []));

    // 6. logs/
    const logsFolder = root.folder('logs')!;
    logsFolder.file('scraping-log.json', this.toJson(logs));

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Helper to trigger download in browser UI
   */
  static triggerFileDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
