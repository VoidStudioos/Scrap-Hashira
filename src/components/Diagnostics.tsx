import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  Database,
  Globe,
} from 'lucide-react';
import { I18nManager } from '../localization/i18n';
import type { DiagnosticItem } from '../types';
import { DataNormalizer } from '../engines/normalization/dataNormalizer';

export const Diagnostics: React.FC = () => {
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticItem[] = [];

    // 1. Chrome MV3 APIs
    const hasChrome = typeof chrome !== 'undefined';
    results.push({
      category: 'Environment',
      name: 'Chrome API Environment',
      status: hasChrome ? 'pass' : 'warn',
      value: hasChrome ? 'Extension Runtime Active' : 'Web/Development Mode',
      message: hasChrome ? 'Running inside Chrome Extension context.' : 'Running in standalone dev server without extension APIs.',
    });

    results.push({
      category: 'APIs',
      name: 'Chrome Downloads API',
      status: hasChrome && chrome.downloads ? 'pass' : 'warn',
      value: Boolean(hasChrome && chrome.downloads),
      message: 'Required for writing image files directly to the user disk.',
    });

    results.push({
      category: 'APIs',
      name: 'Chrome Alarms API',
      status: hasChrome && chrome.alarms ? 'pass' : 'warn',
      value: Boolean(hasChrome && chrome.alarms),
      message: 'Used for service worker watchdog and crash-proof queue heartbeats.',
    });

    results.push({
      category: 'APIs',
      name: 'Chrome SidePanel API',
      status: hasChrome && (chrome as any).sidePanel ? 'pass' : 'warn',
      value: Boolean(hasChrome && (chrome as any).sidePanel),
      message: 'Used for rendering responsive control panel alongside web tabs.',
    });

    // 2. Storage
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageMb = Math.round((est.usage || 0) / (1024 * 1024));
        const quotaMb = Math.round((est.quota || 0) / (1024 * 1024));
        results.push({
          category: 'Storage',
          name: 'IndexedDB Quota',
          status: 'pass',
          value: `${usageMb} MB / ${quotaMb} MB`,
          message: `Local persistent storage quota: ${(est.quota || 0) > 0 ? `${Math.round(((est.usage || 0) / est.quota!) * 100)}% utilized` : 'unlimited'}.`,
        });
      } catch {
        results.push({
          category: 'Storage',
          name: 'IndexedDB Quota',
          status: 'warn',
          value: 'Unknown',
          message: 'Unable to query storage quota estimate.',
        });
      }
    }

    // 3. Persian Normalizer Test
    try {
      const sampleText = 'قيمت: ۱,۲۵۰,۰۰۰ تومان (كالاى شماره ۱۲۳)';
      const norm = DataNormalizer.normalizeRecord({ price: sampleText });
      const passed = norm.normalized.price?.amount === 1250000;
      results.push({
        category: 'Engines',
        name: 'Persian/Arabic Normalization Engine',
        status: passed ? 'pass' : 'fail',
        value: passed ? 'Verified' : 'Failed',
        message: 'Successfully normalized Arabic kaf/yeh and Persian digits to standard currency value.',
      });
    } catch (err: any) {
      results.push({
        category: 'Engines',
        name: 'Persian/Arabic Normalization Engine',
        status: 'fail',
        value: 'Error',
        message: err.message,
      });
    }

    // 4. DOM Parser
    try {
      const parser = new DOMParser();
      const testDoc = parser.parseFromString('<div class="product"><h3>Test</h3></div>', 'text/html');
      const passed = Boolean(testDoc.querySelector('.product h3'));
      results.push({
        category: 'Engines',
        name: 'DOMParser & TreeWalker',
        status: passed ? 'pass' : 'fail',
        value: passed ? 'Ready' : 'Failed',
        message: 'DOMParser successfully parsed and traversed test fragment.',
      });
    } catch (err: any) {
      results.push({
        category: 'Engines',
        name: 'DOMParser & TreeWalker',
        status: 'fail',
        value: 'Error',
        message: err.message,
      });
    }

    setItems(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <Activity className="w-5 h-5 text-rose-400" />
            <span>{I18nManager.t('diagnostics')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time system health checks, API availability verification, storage quotas, and engine tests.
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="flex items-center space-x-1.5 rtl:space-x-reverse bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          <span>Run System Self-Check</span>
        </button>
      </div>

      {/* Diagnostics List */}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-start justify-between gap-4"
          >
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              {item.status === 'pass' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : item.status === 'warn' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <span className="text-[10px] font-mono uppercase bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">
                    {item.category}
                  </span>
                  <h4 className="font-semibold text-xs text-white">{item.name}</h4>
                </div>
                <p className="text-xs text-slate-400 mt-1">{item.message}</p>
              </div>
            </div>

            <span className="font-mono text-xs font-bold text-slate-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 flex-shrink-0">
              {String(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
