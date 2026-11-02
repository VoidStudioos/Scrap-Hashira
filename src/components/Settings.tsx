import React from 'react';
import {
  Settings as SettingsIcon,
  Zap,
  Shield,
  Gauge,
  Sliders,
  Database,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import type { PerformanceMode } from '../types';
import { db } from '../storage/db';

export const Settings: React.FC = () => {
  const { performanceConfig, setPerformanceConfig, loadJobs } = useScraperStore();

  const handleSelectMode = (mode: PerformanceMode) => {
    switch (mode) {
      case 'SAFE':
        setPerformanceConfig({
          mode: 'SAFE',
          maxConcurrentPages: 1,
          maxConcurrentDownloads: 2,
          requestDelayMs: 1500,
          retryCount: 3,
          timeoutMs: 20000,
        });
        break;
      case 'BALANCED':
        setPerformanceConfig({
          mode: 'BALANCED',
          maxConcurrentPages: 3,
          maxConcurrentDownloads: 4,
          requestDelayMs: 600,
          retryCount: 3,
          timeoutMs: 15000,
        });
        break;
      case 'FAST':
        setPerformanceConfig({
          mode: 'FAST',
          maxConcurrentPages: 6,
          maxConcurrentDownloads: 8,
          requestDelayMs: 200,
          retryCount: 2,
          timeoutMs: 10000,
        });
        break;
      case 'CUSTOM':
        setPerformanceConfig({ mode: 'CUSTOM' });
        break;
    }
  };

  const handlePurgeAllData = async () => {
    if (confirm('Are you sure you want to completely erase all local scraping jobs, records, and cached profiles?')) {
      await db.delete();
      await db.open();
      await loadJobs();
      alert('Local storage completely purged.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <SettingsIcon className="w-5 h-5 text-slate-400" />
            <span>{I18nManager.t('settings')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure performance profiles, extraction concurrency, bounded parallelism, and local storage limits.
          </p>
        </div>
      </div>

      {/* Performance Profile Selector Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5 rtl:space-x-reverse">
          <Gauge className="w-4 h-4 text-teal-400" />
          <span>Performance Operating Profiles</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* SAFE */}
          <div
            onClick={() => handleSelectMode('SAFE')}
            className={`cursor-pointer rounded-xl p-4 border transition ${
              performanceConfig.mode === 'SAFE'
                ? 'bg-blue-950/60 border-blue-500 text-white'
                : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Shield className="w-5 h-5 text-blue-400 mb-2" />
            <h4 className="font-bold text-sm">SAFE</h4>
            <p className="text-[11px] text-slate-400 mt-1">
              1 page, 1.5s delay. Ultra gentle for fragile servers.
            </p>
          </div>

          {/* BALANCED */}
          <div
            onClick={() => handleSelectMode('BALANCED')}
            className={`cursor-pointer rounded-xl p-4 border transition ${
              performanceConfig.mode === 'BALANCED'
                ? 'bg-teal-950/60 border-teal-500 text-white'
                : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-5 h-5 text-teal-400 mb-2" />
            <h4 className="font-bold text-sm">BALANCED</h4>
            <p className="text-[11px] text-slate-400 mt-1">
              3 pages, 600ms delay. Recommended standard profile.
            </p>
          </div>

          {/* FAST */}
          <div
            onClick={() => handleSelectMode('FAST')}
            className={`cursor-pointer rounded-xl p-4 border transition ${
              performanceConfig.mode === 'FAST'
                ? 'bg-amber-950/60 border-amber-500 text-white'
                : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-5 h-5 text-amber-400 mb-2" />
            <h4 className="font-bold text-sm">FAST</h4>
            <p className="text-[11px] text-slate-400 mt-1">
              6 pages, 200ms delay. Maximum throughput.
            </p>
          </div>

          {/* CUSTOM */}
          <div
            onClick={() => handleSelectMode('CUSTOM')}
            className={`cursor-pointer rounded-xl p-4 border transition ${
              performanceConfig.mode === 'CUSTOM'
                ? 'bg-purple-950/60 border-purple-500 text-white'
                : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-5 h-5 text-purple-400 mb-2" />
            <h4 className="font-bold text-sm">CUSTOM</h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Fine-tune custom concurrency, limits, and delays.
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Configuration Sliders */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Fine-Tuning Controls</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Max Concurrent Pages:</span>
              <span className="font-mono font-bold text-teal-400">{performanceConfig.maxConcurrentPages}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={performanceConfig.maxConcurrentPages}
              onChange={(e) => setPerformanceConfig({ maxConcurrentPages: parseInt(e.target.value, 10), mode: 'CUSTOM' })}
              className="w-full accent-teal-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Max Concurrent Downloads:</span>
              <span className="font-mono font-bold text-teal-400">{performanceConfig.maxConcurrentDownloads}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={performanceConfig.maxConcurrentDownloads}
              onChange={(e) => setPerformanceConfig({ maxConcurrentDownloads: parseInt(e.target.value, 10), mode: 'CUSTOM' })}
              className="w-full accent-teal-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Request Delay (ms):</span>
              <span className="font-mono font-bold text-teal-400">{performanceConfig.requestDelayMs} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={performanceConfig.requestDelayMs}
              onChange={(e) => setPerformanceConfig({ requestDelayMs: parseInt(e.target.value, 10), mode: 'CUSTOM' })}
              className="w-full accent-teal-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Retry Count:</span>
              <span className="font-mono font-bold text-teal-400">{performanceConfig.retryCount} attempts</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              value={performanceConfig.retryCount}
              onChange={(e) => setPerformanceConfig({ retryCount: parseInt(e.target.value, 10), mode: 'CUSTOM' })}
              className="w-full accent-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Storage & Purge Section */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-rose-300 flex items-center space-x-1.5 rtl:space-x-reverse">
            <Database className="w-4 h-4" />
            <span>Local Database Purge</span>
          </h4>
          <p className="text-xs text-rose-200/70 mt-1">
            Permanently deletes all stored scraping jobs, IndexedDB snapshots, and learned profiles.
          </p>
        </div>

        <button
          onClick={handlePurgeAllData}
          className="flex items-center space-x-1.5 rtl:space-x-reverse bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
          <span>Purge All Local Data</span>
        </button>
      </div>
    </div>
  );
};
