import React, { useState } from 'react';
import {
  DownloadCloud,
  FileCode,
  FileSpreadsheet,
  FileText,
  Archive,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import { ExportManager } from '../exports/exportManager';
import { StorageService } from '../storage/storageService';

export const ExportCenter: React.FC = () => {
  const { activeJob, currentRecords, jobs } = useScraperStore();
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [selectedJobId, setSelectedJobId] = useState<string>(activeJob?.id || (jobs[0]?.id || ''));

  const currentJob = jobs.find((j) => j.id === selectedJobId) || activeJob || jobs[0];

  const handleExportJson = async () => {
    if (!currentJob) return;
    setIsExporting(true);
    const records = await StorageService.getRecordsForJob(currentJob.id);
    const jsonStr = ExportManager.toJson(records.map((r) => ({ ...r.normalizedData, sourceUrl: r.sourceUrl })));
    const blob = new Blob([jsonStr], { type: 'application/json' });
    ExportManager.triggerFileDownload(blob, `hashira-${currentJob.id}-products.json`);
    setIsExporting(false);
  };

  const handleExportJsonLines = async () => {
    if (!currentJob) return;
    setIsExporting(true);
    const records = await StorageService.getRecordsForJob(currentJob.id);
    const jsonlStr = ExportManager.toJsonLines(records.map((r) => ({ ...r.normalizedData, sourceUrl: r.sourceUrl })));
    const blob = new Blob([jsonlStr], { type: 'application/x-ndjson' });
    ExportManager.triggerFileDownload(blob, `hashira-${currentJob.id}-products.jsonl`);
    setIsExporting(false);
  };

  const handleExportCsv = async () => {
    if (!currentJob) return;
    setIsExporting(true);
    const records = await StorageService.getRecordsForJob(currentJob.id);
    const flatRecords = records.map((r) => ({
      Title: r.title,
      Source_URL: r.sourceUrl,
      ...r.normalizedData,
    }));
    const csvStr = ExportManager.toCsv(flatRecords);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    ExportManager.triggerFileDownload(blob, `hashira-${currentJob.id}-products.csv`);
    setIsExporting(false);
  };

  const handleExportXlsx = async () => {
    if (!currentJob) return;
    setIsExporting(true);
    const records = await StorageService.getRecordsForJob(currentJob.id);
    const flatRecords = records.map((r) => ({
      Title: r.title,
      Source_URL: r.sourceUrl,
      ...r.normalizedData,
    }));
    const buffer = ExportManager.toXlsx(flatRecords, 'Extracted Data');
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    ExportManager.triggerFileDownload(blob, `hashira-${currentJob.id}-products.xlsx`);
    setIsExporting(false);
  };

  const handleExportFullZip = async () => {
    if (!currentJob) return;
    setIsExporting(true);
    try {
      const zipBlob = await ExportManager.createCompleteExportZip(currentJob.id);
      ExportManager.triggerFileDownload(zipBlob, `hashira-export-${currentJob.id}.zip`);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <DownloadCloud className="w-5 h-5 text-teal-400" />
            <span>{I18nManager.t('exportCenter')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Export extracted datasets, raw HTML snapshots, images, and telemetry manifests into standards-compliant formats.
          </p>
        </div>

        {jobs.length > 0 && (
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <span className="text-xs text-slate-400">Select Job:</span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} ({j.stats.recordsExtracted} records)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!currentJob ? (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-12 text-center text-xs text-slate-400">
          No data available to export. Run a scraping job first.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Full ZIP Card */}
          <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-slate-900 border border-teal-600/50 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Archive className="w-6 h-6 text-teal-400" />
                <h3 className="text-base font-bold text-white">Full Structured ZIP Archive</h3>
                <span className="bg-teal-500/20 text-teal-300 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">
                  RECOMMENDED
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bundles all products (JSON, CSV, XLSX), HTML snapshots, downloaded product images, table matrices, error logs, and root manifest.json into the complete production package.
              </p>
            </div>

            <button
              onClick={handleExportFullZip}
              disabled={isExporting}
              className="flex items-center justify-center space-x-2 rtl:space-x-reverse bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 py-3 rounded-lg text-sm transition shadow-lg shadow-teal-500/20 flex-shrink-0 disabled:opacity-50"
            >
              <Archive className="w-5 h-5" />
              <span>{isExporting ? 'Generating ZIP...' : 'Download Master ZIP Package'}</span>
            </button>
          </div>

          {/* Individual Export Options Grid */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Individual Format Exports
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* JSON */}
              <div
                onClick={handleExportJson}
                className="cursor-pointer bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-teal-500 rounded-xl p-4 transition flex flex-col justify-between"
              >
                <div>
                  <FileCode className="w-6 h-6 text-amber-400 mb-2" />
                  <h4 className="font-semibold text-sm text-white mb-1">JSON</h4>
                  <p className="text-xs text-slate-400">Structured JSON objects array with UTF-8 Persian support.</p>
                </div>
                <span className="text-[11px] text-teal-400 font-semibold mt-4 block">Export JSON →</span>
              </div>

              {/* JSONL */}
              <div
                onClick={handleExportJsonLines}
                className="cursor-pointer bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-teal-500 rounded-xl p-4 transition flex flex-col justify-between"
              >
                <div>
                  <FileText className="w-6 h-6 text-purple-400 mb-2" />
                  <h4 className="font-semibold text-sm text-white mb-1">JSON Lines</h4>
                  <p className="text-xs text-slate-400">One record per line, ideal for big data and pipeline streaming.</p>
                </div>
                <span className="text-[11px] text-teal-400 font-semibold mt-4 block">Export JSONL →</span>
              </div>

              {/* CSV */}
              <div
                onClick={handleExportCsv}
                className="cursor-pointer bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-teal-500 rounded-xl p-4 transition flex flex-col justify-between"
              >
                <div>
                  <Database className="w-6 h-6 text-cyan-400 mb-2" />
                  <h4 className="font-semibold text-sm text-white mb-1">CSV (Protected)</h4>
                  <p className="text-xs text-slate-400">
                    With UTF-8 BOM and formula injection protection (DDE sanitization).
                  </p>
                </div>
                <span className="text-[11px] text-teal-400 font-semibold mt-4 block">Export CSV →</span>
              </div>

              {/* Excel XLSX */}
              <div
                onClick={handleExportXlsx}
                className="cursor-pointer bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-teal-500 rounded-xl p-4 transition flex flex-col justify-between"
              >
                <div>
                  <FileSpreadsheet className="w-6 h-6 text-emerald-400 mb-2" />
                  <h4 className="font-semibold text-sm text-white mb-1">Excel (.xlsx)</h4>
                  <p className="text-xs text-slate-400">
                    Microsoft Excel binary workbook with styled headers and native UTF-8.
                  </p>
                </div>
                <span className="text-[11px] text-teal-400 font-semibold mt-4 block">Export Excel →</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
