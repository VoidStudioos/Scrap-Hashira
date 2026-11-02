import React, { useState, useEffect } from 'react';
import {
  MousePointerClick,
  CheckCircle,
  Eye,
  Plus,
  Play,
  Save,
  Code,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import { StorageService } from '../storage/storageService';
import type { SelectorRule } from '../types';

export const VisualSelectorPanel: React.FC = () => {
  const { visualSelectorActive, setVisualSelectorActive, visualSelectorData, setVisualSelectorData, loadProfiles, setView } = useScraperStore();
  const [fields, setFields] = useState<SelectorRule[]>([]);
  const [currentFieldName, setCurrentFieldName] = useState<string>('product_name');
  const [recordSelector, setRecordSelector] = useState<string>('.product-card');

  useEffect(() => {
    // Listen for element selections from content script
    const listener = (message: any) => {
      if (message.action === 'VISUAL_ELEMENT_SELECTED') {
        setVisualSelectorData(message.payload);
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

  const handleAddFieldFromSelection = () => {
    if (!visualSelectorData) return;

    const newRule: SelectorRule = {
      field: currentFieldName,
      cssSelector: visualSelectorData.cssSelector,
      xpathFallback: visualSelectorData.xpath,
      attribute: 'text',
      confidence: 0.95,
      isCustom: true,
    };

    setFields([...fields, newRule]);
    setCurrentFieldName('');
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
      recordSelector: recordSelector || fields[0].cssSelector,
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
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1.5 rtl:space-x-reverse">
              <CheckCircle className="w-4 h-4" />
              <span>Element Selected ({visualSelectorData.matchCount} matching elements found on page)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block mb-1">CSS Selector:</span>
              <div className="bg-slate-900 border border-slate-700 p-2 rounded text-emerald-300 break-all">
                {visualSelectorData.cssSelector}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">XPath Fallback:</span>
              <div className="bg-slate-900 border border-slate-700 p-2 rounded text-slate-300 break-all">
                {visualSelectorData.xpath}
              </div>
            </div>
          </div>

          <div>
            <span className="text-slate-400 text-xs block mb-1">Text Preview:</span>
            <div className="bg-slate-900 border border-slate-700 p-2 rounded text-xs text-slate-200">
              "{visualSelectorData.text.substring(0, 150)}"
            </div>
          </div>

          {/* Add to schema row */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input
              type="text"
              placeholder="Field name (e.g. price, title)..."
              value={currentFieldName}
              onChange={(e) => setCurrentFieldName(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleAddFieldFromSelection}
              disabled={!currentFieldName}
              className="flex items-center space-x-1 rtl:space-x-reverse bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded text-xs transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Field Column</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-8 text-center text-xs text-slate-400 space-y-2">
          <Eye className="w-8 h-8 text-slate-500 mx-auto" />
          <p>Click "Activate Visual Selector", then hover and click elements on the page to inspect and capture them.</p>
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
