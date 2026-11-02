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
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import { StorageService } from '../storage/storageService';
import { ExportManager } from '../exports/exportManager';
import type { SelectorRule } from '../types';

export const VisualSelectorPanel: React.FC = () => {
  const {
    visualSelectorActive,
    setVisualSelectorActive,
    visualSelectorData,
    setVisualSelectorData,
    loadProfiles,
    setView,
  } = useScraperStore();

  const [fields, setFields] = useState<SelectorRule[]>([]);
  const [currentFieldName, setCurrentFieldName] = useState<string>('product_name');
  const [activeCssSelector, setActiveCssSelector] = useState<string>('');
  const [currentMatchCount, setCurrentMatchCount] = useState<number>(1);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractedPreview, setExtractedPreview] = useState<any[]>([]);

  useEffect(() => {
    const listener = (message: any) => {
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
      } else if (message.action === 'VISUAL_SELECTOR_CLOSED') {
        setVisualSelectorActive(false);
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

  const updateSelectorAndHighlight = (newSelector: string) => {
    setActiveCssSelector(newSelector);
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: 'UPDATE_SELECTOR_HIGHLIGHT', payload: { selector: newSelector } },
            (res) => {
              if (res?.success && typeof res.count === 'number') {
                setCurrentMatchCount(res.count);
              }
            }
          );
        }
      });
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

  const handleAddFieldFromSelection = () => {
    if (!visualSelectorData || !activeCssSelector) return;

    const newRule: SelectorRule = {
      field: currentFieldName || `field_${fields.length + 1}`,
      cssSelector: activeCssSelector,
      xpathFallback: visualSelectorData.xpath,
      attribute: 'text',
      confidence: 0.95,
      isCustom: true,
    };

    setFields([...fields, newRule]);
    setCurrentFieldName('');
  };

  const handleInstantExtract = () => {
    if (!activeCssSelector) return;
    setIsExtracting(true);

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
          setIsExtracting(false);
          return;
        }

        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: 'EXTRACT_BY_RULES',
            payload: {
              recordSelector: activeCssSelector,
              fieldSelectors: [
                { field: currentFieldName || 'item', cssSelector: '', attribute: 'text' },
              ],
              jobId: 'visual_job',
            },
          },
          (res) => {
            setIsExtracting(false);
            if (res?.success && res.data) {
              setExtractedPreview(res.data);
            }
          }
        );
      });
    }
  };

  const handleExportExtractedExcel = () => {
    if (!extractedPreview.length) return;
    const rows = extractedPreview.map((item, idx) => ({
      Index: idx + 1,
      Value: item.title || item.data?.item || '',
      Source_URL: item.sourceUrl,
    }));
    const buf = ExportManager.toXlsx(rows, 'Visual Extraction');
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    ExportManager.triggerFileDownload(blob, `hashira-visual-${Date.now()}.xlsx`);
  };

  const handleSaveAsProfile = async () => {
    if (fields.length === 0) {
      alert('Please select and add at least one field before saving.');
      return;
    }

    const domain = window.location.hostname || 'example.com';
    await StorageService.saveProfile({
      domain,
      name: `Visual Profile - ${domain}`,
      pageType: 'catalog',
      urlPattern: '.*',
      recordSelector: activeCssSelector || fields[0].cssSelector,
      fieldSelectors: fields,
      confidenceScore: 0.95,
      successCount: 1,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await loadProfiles();
    alert('Site profile saved to Smart Learning!');
    setView('learning');
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
            Click elements on live web pages to generate resilient CSS/XPath selectors and extract structured columns.
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

      {/* Active Selection Inspector */}
      {visualSelectorData ? (
        <div className="bg-slate-800/70 border border-emerald-500/50 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
            <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1.5 rtl:space-x-reverse">
              <CheckCircle className="w-4 h-4" />
              <span>
                Element Selected ({currentMatchCount} matching elements found on page)
              </span>
            </span>

            {/* Scope Toggle: All Similar vs Single Item */}
            <div className="flex items-center space-x-1 rtl:space-x-reverse bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => handleSelectMode('repeated')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  activeCssSelector !== visualSelectorData.exactSelector
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎯 Select All Similar ({visualSelectorData.repeatedMatchCount || currentMatchCount})
              </button>
              <button
                onClick={() => handleSelectMode('exact')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  activeCssSelector === visualSelectorData.exactSelector
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📌 Single Item Only (1)
              </button>
            </div>
          </div>

          {/* Editable CSS Selector */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium flex items-center space-x-1 rtl:space-x-reverse">
                <Code className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSS Selector (Editable):</span>
              </label>
              <span className="text-emerald-400 font-mono text-[11px]">
                Matches {currentMatchCount} elements
              </span>
            </div>
            <input
              type="text"
              value={activeCssSelector}
              onChange={(e) => updateSelectorAndHighlight(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <span className="text-slate-400 text-xs block mb-1">Text Preview:</span>
            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded text-xs text-slate-200 truncate">
              "{visualSelectorData.text?.substring(0, 150) || visualSelectorData.sampleValues?.[0] || 'No text content'}"
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <input
                type="text"
                placeholder="Column name (e.g. title, price)..."
                value={currentFieldName}
                onChange={(e) => setCurrentFieldName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleAddFieldFromSelection}
                className="flex items-center space-x-1 rtl:space-x-reverse bg-slate-700 hover:bg-slate-600 text-white font-medium px-3 py-1.5 rounded text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Column</span>
              </button>
            </div>

            <button
              onClick={handleInstantExtract}
              disabled={isExtracting}
              className="flex items-center space-x-1.5 rtl:space-x-reverse bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs shadow-md transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isExtracting
                  ? 'Extracting...'
                  : `Extract All ${currentMatchCount} Items Now`}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-8 text-center text-xs text-slate-400 space-y-2">
          <Eye className="w-8 h-8 text-slate-500 mx-auto" />
          <p>
            Click "Activate Visual Selector", then hover and click any element on the page. Hashira automatically generalizes selectors to capture all matching items in the list!
          </p>
        </div>
      )}

      {/* Instant Extracted Results Table */}
      {extractedPreview.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h3 className="text-xs font-semibold text-white flex items-center space-x-1.5 rtl:space-x-reverse">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Extracted Results ({extractedPreview.length} items)</span>
            </h3>

            <button
              onClick={handleExportExtractedExcel}
              className="flex items-center space-x-1.5 rtl:space-x-reverse bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition shadow"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export to Excel (.xlsx)</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-lg">
            <table className="w-full text-xs text-left rtl:text-right text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="px-3 py-2 w-12">#</th>
                  <th className="px-3 py-2">Extracted Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {extractedPreview.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/20">
                    <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2 text-white">
                      {item.title || item.data?.item || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configured Fields List */}
      {fields.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5 rtl:space-x-reverse">
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Configured Fields ({fields.length})</span>
            </h3>

            <button
              onClick={handleSaveAsProfile}
              className="flex items-center space-x-1.5 rtl:space-x-reverse bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{I18nManager.t('saveProfile')}</span>
            </button>
          </div>

          <div className="space-y-2">
            {fields.map((f, i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-700/80 p-2.5 rounded-lg flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <span className="text-emerald-400 font-bold">{f.field}</span>
                  <span className="text-slate-400 font-normal">→ {f.cssSelector}</span>
                </div>
                <button
                  onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
                  className="text-rose-400 hover:text-rose-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
