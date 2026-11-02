import React, { useState } from 'react';
import {
  Scan,
  CheckCircle,
  Play,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  AlertTriangle,
  ExternalLink,
  Store,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import type { CandidateSchema } from '../engines/detection/autoDetector';

export const OneClickScraper: React.FC = () => {
  const {
    detectedSchemas,
    isScanning,
    scanError,
    activeTabUrl,
    scanActiveTab,
    openDemoPage,
    startOneClickJob,
    setView,
  } = useScraperStore();

  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState<number>(0);

  const activeSchema: CandidateSchema | undefined = detectedSchemas[selectedSchemaIndex] || detectedSchemas[0];

  const handleStart = async () => {
    if (!activeSchema) return;
    await startOneClickJob(activeSchema);
    setView('dashboard');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>{I18nManager.t('oneClickScraper')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Automatic structural detection engine with confidence scoring and live preview.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openDemoPage}
            className="flex items-center space-x-1.5 rtl:space-x-reverse bg-slate-800 hover:bg-slate-700 text-teal-300 font-medium px-3 py-2 rounded-lg text-xs border border-teal-500/30 transition shadow-sm"
            title="Open an interactive sample store in a new tab to test scraping"
          >
            <Store className="w-4 h-4 text-teal-400" />
            <span>Open Demo Page</span>
          </button>

          <button
            onClick={scanActiveTab}
            disabled={isScanning}
            className="flex items-center space-x-2 rtl:space-x-reverse bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs transition shadow disabled:opacity-50"
          >
            <Scan className="w-4 h-4" />
            <span>{isScanning ? 'Analyzing DOM...' : I18nManager.t('detectData')}</span>
          </button>
        </div>
      </div>

      {/* Chrome Internal Page Alert */}
      {scanError === 'CHROME_INTERNAL' && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-5 space-y-3">
          <div className="flex items-start space-x-3 rtl:space-x-reverse">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-amber-200">
                Cannot Scrape Internal Browser Page
              </h4>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Your active tab is on an internal Chrome URL (<code className="bg-slate-900/60 px-1.5 py-0.5 rounded text-amber-300 font-mono">{activeTabUrl || 'chrome://extensions'}</code>).
                Chrome security policies strictly prevent extensions from injecting scripts into browser settings or extension management pages.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={openDemoPage}
              className="flex items-center space-x-1.5 rtl:space-x-reverse bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Launch Demo Store Page to Test</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State when no schemas detected */}
      {detectedSchemas.length === 0 && scanError !== 'CHROME_INTERNAL' && (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Scan className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No Extractable Structure Detected Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Navigate your active tab to any website (e.g. an e-commerce catalog, blog, or table) and click "Scan Active Webpage", or try the demo page.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={scanActiveTab}
              disabled={isScanning}
              className="inline-flex items-center space-x-1.5 rtl:space-x-reverse bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition"
            >
              <span>{isScanning ? 'Scanning...' : 'Scan Active Webpage'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={openDemoPage}
              className="inline-flex items-center space-x-1.5 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-teal-300 text-xs px-4 py-2 rounded-lg transition"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Open Demo Store</span>
            </button>
          </div>
        </div>
      )}

      {/* Detected Schemas View */}
      {detectedSchemas.length > 0 && (
        <div className="space-y-6">
          {/* Schema Selector Tabs */}
          <div className="flex items-center space-x-2 rtl:space-x-reverse overflow-x-auto pb-1">
            {detectedSchemas.map((schema, idx) => {
              const isSelected = idx === selectedSchemaIndex;
              const confidencePercent = Math.round(schema.confidence * 100);
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedSchemaIndex(idx)}
                  className={`flex items-center space-x-2 rtl:space-x-reverse px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition border ${
                    isSelected
                      ? 'bg-teal-900/60 border-teal-500 text-teal-200 shadow-sm'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  <span>{schema.title}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      confidencePercent >= 90
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : confidencePercent >= 75
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {confidencePercent}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Schema Summary */}
          {activeSchema && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center space-x-2 rtl:space-x-reverse">
                    <span>{activeSchema.title}</span>
                    <span className="text-xs text-slate-400 font-mono">({activeSchema.sampleCount} detected)</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Selector: <code className="text-teal-300">{activeSchema.recordSelector}</code>
                  </p>
                </div>

                <button
                  onClick={handleStart}
                  className="flex items-center space-x-2 rtl:space-x-reverse bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs shadow-md transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{I18nManager.t('startScraping')}</span>
                </button>
              </div>

              {/* Detected Fields Pill list */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Detected Fields ({activeSchema.fields.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeSchema.fields.map((f, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-md text-xs flex items-center space-x-1.5 rtl:space-x-reverse"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
                      <span className="text-slate-200 font-medium">{f.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({f.attribute})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center space-x-1 rtl:space-x-reverse">
                  <Database className="w-3.5 h-3.5 text-teal-400" />
                  <span>Live Extraction Preview (First 5 records)</span>
                </span>
                <div className="overflow-x-auto border border-slate-700/80 rounded-lg">
                  <table className="w-full text-xs text-left rtl:text-right text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        {activeSchema.fields.map((f, i) => (
                          <th key={i} className="px-3 py-2 font-semibold">
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {activeSchema.previewRecords.map((rec, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-mono text-slate-500">{rIdx + 1}</td>
                          {activeSchema.fields.map((f, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 max-w-[200px] truncate">
                              {f.name === 'image' && rec[f.name] ? (
                                <img
                                  src={rec[f.name]}
                                  alt=""
                                  className="w-8 h-8 object-cover rounded border border-slate-700"
                                />
                              ) : (
                                String(rec[f.name] || '-')
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
