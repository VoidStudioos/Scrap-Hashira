import React, { useEffect } from 'react';
import {
  Scan,
  MousePointerClick,
  PanelRightOpen,
  Layers,
  Sparkles,
  Download,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';

export const Popup: React.FC = () => {
  const { activeJob, loadJobs, scanActiveTab, isScanning, setVisualSelectorActive, visualSelectorActive } = useScraperStore();

  useEffect(() => {
    loadJobs();
  }, []);

  const handleOpenSidePanel = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'OPEN_SIDEPANEL' }, () => {
        void chrome.runtime.lastError;
      });
      window.close();
    }
  };

  return (
    <div className="w-[360px] min-h-[460px] bg-slate-900 text-slate-100 flex flex-col justify-between p-4 font-sans select-none">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-slate-950 text-sm shadow">
              H
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-tight">Hashira Scraper</h1>
              <span className="text-[10px] text-teal-400 font-mono">v2.0 PRO</span>
            </div>
          </div>

          <button
            onClick={handleOpenSidePanel}
            className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] px-2.5 py-1 rounded-md border border-slate-700 transition"
            title="Expand into full Side Panel"
          >
            <PanelRightOpen className="w-3.5 h-3.5 text-teal-400" />
            <span>Open Side Panel</span>
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Status</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeJob?.state === 'RUNNING'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {activeJob ? activeJob.state : 'IDLE'}
            </span>
          </div>

          {activeJob ? (
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-white truncate">{activeJob.name}</p>
              <div className="flex justify-between text-slate-400 text-[11px] pt-1">
                <span>Products: <strong className="text-teal-400">{activeJob.stats.recordsExtracted}</strong></span>
                <span>Images: <strong className="text-rose-400">{activeJob.stats.imagesDownloaded}</strong></span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Ready to detect extractable data on the active tab.</p>
          )}
        </div>

        {/* Quick Launch Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              scanActiveTab();
              handleOpenSidePanel();
            }}
            disabled={isScanning}
            className="w-full flex items-center justify-center space-x-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-lg text-xs transition shadow shadow-teal-500/10"
          >
            <Scan className="w-4 h-4" />
            <span>{isScanning ? 'Analyzing DOM...' : 'Detect Data on This Page'}</span>
          </button>

          <button
            onClick={async () => {
              await setVisualSelectorActive(!visualSelectorActive);
              window.close();
            }}
            className={`w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-semibold border transition ${
              visualSelectorActive
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
          >
            <MousePointerClick className="w-4 h-4 text-emerald-400" />
            <span>{visualSelectorActive ? 'Stop Visual Selector' : 'Launch Visual Element Selector'}</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>LOCAL-FIRST ENCRYPTED</span>
        <span>CHROME MV3 READY</span>
      </div>
    </div>
  );
};
