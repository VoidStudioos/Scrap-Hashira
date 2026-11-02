import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoDetector } from '../../src/engines/detection/autoDetector';
import { StorageService } from '../../src/storage/storageService';
import { FullCaptureEngine } from '../../src/engines/crawler/fullCapture';
import { ExportManager } from '../../src/exports/exportManager';
import { ResumeEngine } from '../../src/engines/resume/resumeEngine';
import { DataNormalizer } from '../../src/engines/normalization/dataNormalizer';

describe('Complete End-to-End Scraping & Export Pipeline', () => {
  let doc: Document;

  beforeAll(() => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sample-catalog.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');
    const parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
  });

  it('executes full pipeline: detect -> job creation -> capture -> normalize -> export ZIP', async () => {
    const url = 'https://example.com/autoparts';

    // 1. Detection
    const detection = AutoDetector.detect(doc, url);
    expect(detection.schemas.length).toBeGreaterThan(0);
    expect(detection.tables.length).toBeGreaterThan(0);

    const schema = detection.schemas[0];

    // 2. Create Job in Storage
    const job = await StorageService.createJob(url, 'Integration Test Scrape');
    expect(job.id).toBeDefined();

    // 3. Extract & Normalize Records
    const rawCards = Array.from(doc.querySelectorAll(schema.recordSelector));
    expect(rawCards.length).toBeGreaterThan(0);

    const extractedRecords = rawCards.map((card, idx) => {
      const rawData: Record<string, any> = {};
      for (const field of schema.fields) {
        const target = field.cssSelector ? card.querySelector(field.cssSelector) : card;
        rawData[field.name] = target?.textContent?.trim() || '';
      }

      const normalized = DataNormalizer.normalizeRecord(rawData);
      return {
        jobId: job.id,
        recordIndex: idx,
        sourceUrl: url,
        title: rawData.product_name || `Product #${idx + 1}`,
        data: rawData,
        normalizedData: normalized.normalized,
        images: [],
        confidence: normalized.completenessScore / 100,
        extractedAt: Date.now(),
      };
    });

    await StorageService.addRecords(extractedRecords);
    await StorageService.addTables(detection.tables.map((t) => ({ ...t, jobId: job.id })));

    // 4. Capture Full Page Snapshot
    const captureResult = await FullCaptureEngine.captureCurrentPage(job.id, doc, url);
    expect(captureResult.snapshot.id).toBeDefined();

    // 5. Verify Checkpointing
    const checkpoint = await ResumeEngine.createCheckpoint(job.id);
    expect(checkpoint).toBeDefined();
    expect(checkpoint?.completedRecordsCount).toBe(extractedRecords.length);

    // 6. Complete Job
    await StorageService.updateJobState(job.id, 'COMPLETED');

    // 7. Verify Database Records
    const savedRecords = await StorageService.getRecordsForJob(job.id);
    expect(savedRecords.length).toBe(extractedRecords.length);

    // 8. Generate Complete ZIP Export
    const zipBlob = await ExportManager.createCompleteExportZip(job.id);
    expect(zipBlob).toBeDefined();
    expect(zipBlob.size).toBeGreaterThan(500); // Valid zip archive with manifest, data, and metadata
  });
});
