import React, { useState, useEffect } from 'react';
import {
  MousePointerClick,
  CheckCircle,
  Eye,
  Plus,
  Play,
  Save,
  Code,
  Layers,
  Sparkles,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import { StorageService } from '../storage/storageService';
import { ExportManager } from '../exports/exportManager';
import { ImageDownloader } from '../engines/images/imageDownloader';
import type { SelectorRule, ExtractedImage } from '../types';
import { sendTabMessage } from '../utils/chromeTab';

export const VisualSelectorPanel: React.FC = () => {
  const {
    visualSelectorActive,
    setVisualSelectorActive,
    visualSelectorData,
    setVisualSelectorData,
    loadProfiles,
    setView,
    openDemoPage,
    scanError,
  } = useScraperStore();

  const [fields, setFields] = useState<SelectorRule[]>([]);
  const [currentFieldName, setCurrentFieldName] = useState<string>('Item');
  const [activeCssSelector, setActiveCssSelector] = useState<string>('');
  const [currentMatchCount, setCurrentMatchCount] = useState<number>(0);
  const [extractedPreview, setExtractedPreview] = useState<any[]>([]);
  const [isDownloadingImages, setIsDownloadingImages] = useState<boolean>(false);

  useEffect(() => {
    const listener = (message: any, _sender: any, sendResponse?: (res: any) => void) => {
      if (message.action === 'VISUAL_ELEMENT_SELECTED') {
        const payload = message.payload;
        setVisualSelectorData(payload);

        // Prefer repeatedSelector if multiple matches exist, else exact
        const initialSelector =
          payload.repeatedSelector && payload.repeatedMatchCount > 1
            ? payload.repeatedSelector
            : payload.cssSelector;

        setActiveCssSelector(initialSelector);
        setCurrentMatchCount(payload.matchCount || 1);

        // Instantly display all extracted items in the table!
        if (payload.allExtractedItems && payload.allExtractedItems.length > 0) {
          setExtractedPreview(payload.allExtractedItems);
        }
        if (sendResponse) sendResponse({ received: true });
      } else if (message.action === 'VISUAL_SELECTOR_CLOSED') {
        setVisualSelectorActive(false);
        if (sendResponse) sendResponse({ received: true });
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  const handleToggleSelector = () => {
    setVisualSelectorActive(!visualSelectorActive);
  };

  const updateSelectorAndHighlight = async (newSelector: string) => {
    setActiveCssSelector(newSelector);
    if (!newSelector.trim()) return;

    const res = await sendTabMessage<any>('UPDATE_SELECTOR_HIGHLIGHT', { selector: newSelector });
    if (res?.success) {
      setCurrentMatchCount(res.count || 0);
      if (res.items) {
        setExtractedPreview(res.items);
      }
    }
  };

  const handleSelectMode = (mode: 'repeated' | 'exact') => {
    if (!visualSelectorData) return;
    const targetSelector =
      mode === 'repeated'
        ? visualSelectorData.repeatedSelector || visualSelectorData.cssSelector
        : visualSelectorData.exactSelector || visualSelectorData.cssSelector;

    updateSelectorAndHighlight(targetSelector);
  };

  const handleExportExtractedExcel = () => {
    if (!extractedPreview.length) return;
    const rows = extractedPreview.map((item, idx) => ({
      '#': idx + 1,
      [currentFieldName || 'Extracted_Data']: item.value || '',
      Image_URL: item.imageUrl || '',
      Link_URL: item.linkUrl || '',
    }));
    const buf = ExportManager.toXlsx(rows, 'Extracted Data');
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    ExportManager.triggerFileDownload(blob, `hashira-extracted-${Date.now()}.xlsx`);
  };

  const handleExportExtractedCsv = () => {
    if (!extractedPreview.length) return;
    const rows = extractedPreview.map((item, idx) => ({
      Index: idx + 1,
      [currentFieldName || 'Extracted_Data']: item.value || '',
      Image_URL: item.imageUrl || '',
      Link_URL: item.linkUrl || '',
    }));
    const csvStr = ExportManager.toCsv(rows);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    ExportManager.triggerFileDownload(blob, `hashira-extracted-${Date.now()}.csv`);
  };

  const handleDownloadAllImages = async () => {
    const imagesToDownload = extractedPreview
      .filter((i) => i.imageUrl || (i.isImage && i.value))
      .map((i, idx) => {
        const url = i.imageUrl || i.value;
        return {
          jobId: 'visual_job',
          sourceUrl: url,
          resolvedUrl: url,
          fileName: `image_${String(idx + 1).padStart(3, '0')}.jpg`,
          classification: 'product',
          confidence: 0.9,
          status: 'discovered',
          downloadAttempts: 0,
        } as ExtractedImage;
      });

    if (imagesToDownload.length === 0) {
      alert('No image URLs found in the selected elements.');
      return;
    }

    setIsDownloadingImages(true);
    const downloader = new ImageDownloader(4);
    downloader.enqueue(imagesToDownload);
    await downloader.start();
    setIsDownloadingImages(false);
    alert(`Downloaded ${imagesToDownload.length} images to your downloads folder.`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <MousePointerClick className="w-5 h-5 text-emerald-400" />
            <span>{I18nManager.t('visualSelector')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Click any element on the webpage. Hashira automatically detects and extracts all repeated matching items in real time.
          </p>
        </div>

        <button
          onClick={handleToggleSelector}
          className={`flex items-center space-x-2 rtl:space-x-reverse font-bold px-4 py-2 rounded-lg text-xs transition shadow ${
            visualSelectorActive
              ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
              : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
          }`}
        >
          <MousePointerClick className="w-4 h-4" />
          <span>{visualSelectorActive ? 'Stop Selector Overlay' : I18nManager.t('activateSelector')}</span>
        </button>
      </div>

      {/* Active State / Internal Page Guidance Banner */}
      {scanError === 'CHROME_INTERNAL' ? (
        <div className="bg-amber-950/40 border border-amber-600/60 rounded-xl p-4 text-xs text-amber-200 space-y-2">
          <div className="font-bold flex items-center space-x-1.5 rtl:space-x-reverse text-amber-300">
            <span>⚠️ Chrome Security Restriction</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-300/80">
            Chrome prevents extensions from running scripts on internal pages (<code className="bg-slate-900 px-1 py-0.5 rounded text-amber-400">chrome://</code>, <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-400">chrome-extension://</code>). Please switch to an external website or click below to launch the local demo store.
          </p>
          <button
            onClick={openDemoPage}
            className="flex items-center space-x-1.5 rtl:space-x-reverse bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Demo Store</span>
          </button>
        </div>
      ) : visualSelectorActive && !visualSelectorData ? (
        <div className="bg-emerald-950/40 border border-emerald-500/60 rounded-xl p-3.5 text-xs text-emerald-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-300">
              Selector is active! Move your mouse over any element on the page and click it.
            </span>
          </div>
        </div>
      ) : null}

      {/* Active Selection Inspector */}
      {visualSelectorData ? (
        <div className="bg-slate-800/70 border border-emerald-500/50 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-emerald-400">
                {currentMatchCount} matching elements selected
              </span>
            </div>

            {/* Scope Toggle: All Similar vs Single Item */}
            <div className="flex items-center space-x-1 rtl:space-x-reverse bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => handleSelectMode('repeated')}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  activeCssSelector !== visualSelectorData.exactSelector
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎯 Select All Similar ({visualSelectorData.repeatedMatchCount || currentMatchCount})
              </button>
              <button
                onClick={() => handleSelectMode('exact')}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  activeCssSelector === visualSelectorData.exactSelector
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📌 Single Item Only (1)
              </button>
            </div>
          </div>

          {/* Quick Preset Chips for Selecting Multiple Items */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Quick Multi-Select Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {visualSelectorData.repeatedSelector && (
                <button
                  type="button"
                  onClick={() => updateSelectorAndHighlight(visualSelectorData.repeatedSelector)}
                  className="bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 text-[10px] px-2.5 py-1 rounded-md font-medium transition"
                >
                  ⭐ All Similar Items ({visualSelectorData.repeatedMatchCount || currentMatchCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => updateSelectorAndHighlight('img')}
                className="bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded-md transition"
              >
                🖼️ All Images (img)
              </button>
              <button
                type="button"
                onClick={() => updateSelectorAndHighlight('a')}
                className="bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded-md transition"
              >
                🔗 All Links (a)
              </button>
              <button
                type="button"
                onClick={() => updateSelectorAndHighlight('tr td')}
                className="bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded-md transition"
              >
                📊 Table Cells (tr td)
              </button>
              <button
                type="button"
                onClick={() => updateSelectorAndHighlight('.card, .product-card, .item, article')}
                className="bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded-md transition"
              >
                📦 All Cards (.card, article)
              </button>
            </div>
          </div>

          {/* Editable CSS Selector with Apply Button */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium flex items-center space-x-1 rtl:space-x-reverse">
                <Code className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSS Selector:</span>
              </label>
              <span className="text-slate-400 text-[11px]">
                Type or edit any selector, then press Enter or click Apply.
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={activeCssSelector}
                onChange={(e) => setActiveCssSelector(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateSelectorAndHighlight(activeCssSelector);
                  }
                }}
                placeholder="e.g. img[id^='imgEgrp'], .product-title, tr td:nth-child(2)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => updateSelectorAndHighlight(activeCssSelector)}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Quick Actions & Column Name */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span className="text-xs text-slate-400">Column Name:</span>
              <input
                type="text"
                value={currentFieldName}
                onChange={(e) => setCurrentFieldName(e.target.value)}
                placeholder="Column Name"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            {/* Direct Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportExtractedExcel}
                disabled={extractedPreview.length === 0}
                className="flex items-center space-x-1.5 rtl:space-x-reverse bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs transition shadow disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel ({extractedPreview.length})</span>
              </button>

              <button
                onClick={handleExportExtractedCsv}
                disabled={extractedPreview.length === 0}
                className="flex items-center space-x-1.5 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

              {extractedPreview.some((i) => i.isImage || i.imageUrl) && (
                <button
                  onClick={handleDownloadAllImages}
                  disabled={isDownloadingImages}
                  className="flex items-center space-x-1.5 rtl:space-x-reverse bg-rose-600 hover:bg-rose-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition shadow disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{isDownloadingImages ? 'Downloading...' : 'Download Images'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-10 text-center text-xs text-slate-400 space-y-3">
          <Eye className="w-10 h-10 text-emerald-500/50 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">Interactive Visual Selector</h3>
          <p className="max-w-md mx-auto leading-relaxed">
            1. Click <strong>"Activate Visual Selector"</strong> above.<br />
            2. Click any element on your webpage (photo, title, price, or link).<br />
            3. Hashira will instantly highlight and extract <strong>all matching items in that list</strong> and show them in a live table below!
          </p>
        </div>
      )}

      {/* Live Extracted Results Table (Immediately visible!) */}
      {extractedPreview.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Extracted Items Table ({extractedPreview.length} rows)</span>
            </h3>

            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <button
                onClick={handleExportExtractedExcel}
                className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 text-xs font-semibold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Save Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-700 rounded-lg">
            <table className="w-full text-xs text-left rtl:text-right text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-700">
                <tr>
                  <th className="px-3 py-2 w-12 text-center">#</th>
                  {extractedPreview.some((i) => i.isImage || i.imageUrl) && (
                    <th className="px-3 py-2 w-20">Preview</th>
                  )}
                  <th className="px-3 py-2">{currentFieldName || 'Extracted Value'}</th>
                  {extractedPreview.some((i) => i.linkUrl) && (
                    <th className="px-3 py-2">Link</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {extractedPreview.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/20">
                    <td className="px-3 py-2 text-slate-500 font-mono text-center">{idx + 1}</td>
                    {extractedPreview.some((i) => i.isImage || i.imageUrl) && (
                      <td className="px-3 py-1">
                        {item.imageUrl || (item.isImage && item.value) ? (
                          <img
                            src={item.imageUrl || item.value}
                            alt=""
                            className="w-10 h-10 object-cover rounded border border-slate-700 bg-slate-900"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          '-'
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-white font-medium break-all">
                      {item.value || '-'}
                    </td>
                    {extractedPreview.some((i) => i.linkUrl) && (
                      <td className="px-3 py-2 text-slate-400 truncate max-w-[200px]">
                        {item.linkUrl ? (
                          <a
                            href={item.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-400 hover:underline flex items-center space-x-1 rtl:space-x-reverse"
                          >
                            <span className="truncate">{item.linkUrl}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
