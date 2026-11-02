import React, { useEffect, useState } from 'react';
import {
  FileText,
  Layers,
  Table as TableIcon,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Activity,
  Play,
  Pause,
  StopCircle,
  Scan,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';

export const Dashboard: React.FC = () => {
  const { activeJob, loadJobs, scanActiveTab, setView, isScanning, pauseJob, resumeJob, stopJob } = useScraperStore();
  const [storageBytes, setStorageBytes] = useState<number>(0);

  useEffect(() => {
    loadJobs();
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageBytes(est.usage || 0);
      });
    }
  }, []);

  const stats = activeJob?.stats || {
    pagesDiscovered: 0,
    pagesProcessed: 0,
    recordsExtracted: 0,
    tablesExtracted: 0,
    imagesDiscovered: 0,
    imagesDownloaded: 0,
    downloadFailures: 0,
    storageUsedBytes: 0,
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const statCards = [
    { label: I18nManager.t('pagesDiscovered'), value: stats.pagesDiscovered, icon: <FileText className="w-5 h-5 text-blue-500" /> },
    { label: I18nManager.t('pagesProcessed'), value: stats.pagesProcessed, icon: <Layers className="w-5 h-5 text-indigo-500" /> },
    { label: I18nManager.t('productsExtracted'), value: stats.recordsExtracted, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
    { label: I18nManager.t('tablesExtracted'), value: stats.tablesExtracted, icon: <TableIcon className="w-5 h-5 text-purple-500" /> },
    { label: I18nManager.t('imagesDiscovered'), value: stats.imagesDiscovered, icon: <ImageIcon className="w-5 h-5 text-amber-500" /> },
    { label: I18nManager.t('imagesDownloaded'), value: stats.imagesDownloaded, icon: <CheckCircle2 className="w-5 h-5 text-teal-500" /> },
    { label: I18nManager.t('downloadFailures'), value: stats.downloadFailures, icon: <AlertTriangle className="w-5 h-5 text-rose-500" /> },
    { label: I18nManager.t('storageUsage'), value: formatBytes(storageBytes), icon: <HardDrive className="w-5 h-5 text-slate-400" /> },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-slate-900 border border-teal-800/40 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              {activeJob ? activeJob.name : I18nManager.t('readyToScrape')}
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            {activeJob ? activeJob.startingUrl : I18nManager.t('noActiveJob')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              scanActiveTab();
              setView('oneClick');
            }}
            disabled={isScanning}
            className="flex items-center space-x-1.5 rtl:space-x-reverse bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs shadow-md transition disabled:opacity-50"
          >
            <Scan className="w-4 h-4" />
            <span>{isScanning ? 'Scanning...' : I18nManager.t('detectData')}</span>
          </button>

          {activeJob && activeJob.state === 'RUNNING' && (
            <button
              onClick={() => pauseJob(activeJob.id)}
              className="flex items-center space-x-1.5 rtl:space-x-reverse bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-2 rounded-lg text-xs transition"
            >
              <Pause className="w-4 h-4" />
              <span>{I18nManager.t('pause')}</span>
            </button>
          )}

          {activeJob && (activeJob.state === 'PAUSED' || activeJob.state === 'INTERRUPTED') && (
            <button
              onClick={() => resumeJob(activeJob.id)}
              className="flex items-center space-x-1.5 rtl:space-x-reverse bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2 rounded-lg text-xs transition"
            >
              <Play className="w-4 h-4" />
              <span>{I18nManager.t('resume')}</span>
            </button>
          )}

          {activeJob && (activeJob.state === 'RUNNING' || activeJob.state === 'PAUSED') && (
            <button
              onClick={() => stopJob(activeJob.id)}
              className="flex items-center space-x-1.5 rtl:space-x-reverse bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-2 rounded-lg text-xs transition"
            >
              <StopCircle className="w-4 h-4" />
              <span>{I18nManager.t('stop')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Real Statistics Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center space-x-2 rtl:space-x-reverse">
          <Activity className="w-4 h-4 text-teal-400" />
          <span>Extraction Telemetry</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((card, i) => (
            <div
              key={i}
              className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 flex flex-col justify-between hover:border-slate-600 transition"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-medium leading-tight">{card.label}</span>
                {card.icon}
              </div>
              <span className="text-xl font-bold text-white tracking-tight">{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setView('oneClick')}
          className="cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700 rounded-xl p-4 transition group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <Scan className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-100 text-sm mb-1">{I18nManager.t('oneClickScraper')}</h4>
          <p className="text-xs text-slate-400">
            Automatically detects products, lists, and tables with confidence scoring.
          </p>
        </div>

        <div
          onClick={() => setView('explorer')}
          className="cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700 rounded-xl p-4 transition group"
        >
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <Layers className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-100 text-sm mb-1">{I18nManager.t('smartSiteExplorer')}</h4>
          <p className="text-xs text-slate-400">
            Generate an interactive site map, classify product links, and pick branches.
          </p>
        </div>

        <div
          onClick={() => setView('learning')}
          className="cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700 rounded-xl p-4 transition group"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-100 text-sm mb-1">{I18nManager.t('smartLearning')}</h4>
          <p className="text-xs text-slate-400">
            Persistent selector memory with multi-signal resilience and DOM drift detection.
          </p>
        </div>
      </div>
    </div>
  );
};
