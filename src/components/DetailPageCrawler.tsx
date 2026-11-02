import React, { useState } from 'react';
import {
  FolderGit2,
  Play,
  Settings,
  Link,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';

export const DetailPageCrawler: React.FC = () => {
  const { performanceConfig, setPerformanceConfig, activeJob, setView } = useScraperStore();
  const [detailPattern, setDetailPattern] = useState<string>('/product/*, /item/*, /p/*');
  const [extractImagesFromDetail, setExtractImagesFromDetail] = useState<boolean>(true);
  const [extractSpecifications, setExtractSpecifications] = useState<boolean>(true);

  const handleStartCrawler = () => {
    setView('jobs');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
            <span>{I18nManager.t('detailPageCrawler')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Traverse from catalog listing cards directly into individual product detail pages to extract deep attributes and galleries.
          </p>
        </div>

        <button
          onClick={handleStartCrawler}
          className="flex items-center space-x-2 rtl:space-x-reverse bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shadow"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Launch Deep Crawler</span>
        </button>
      </div>

      {/* Detail Crawler Settings Card */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2 rtl:space-x-reverse">
          <Settings className="w-4 h-4 text-indigo-400" />
          <span>Detail Page Traversal Rules</span>
        </h3>

        <div className="space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Detail URL Match Patterns (Comma-separated wildcard patterns)
            </label>
            <div className="relative">
              <Link className="w-4 h-4 absolute left-3 top-2.5 rtl:left-auto rtl:right-3 text-slate-500" />
              <input
                type="text"
                value={detailPattern}
                onChange={(e) => setDetailPattern(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex items-start space-x-3 rtl:space-x-reverse">
              <input
                type="checkbox"
                id="extractDetailImages"
                checked={extractImagesFromDetail}
                onChange={(e) => setExtractImagesFromDetail(e.target.checked)}
                className="mt-0.5 accent-indigo-500 rounded"
              />
              <label htmlFor="extractDetailImages" className="text-slate-300 cursor-pointer">
                <span className="font-semibold block text-white mb-0.5">Deep Gallery Extraction</span>
                Extract all high-resolution gallery and thumbnail images on every visited detail page.
              </label>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex items-start space-x-3 rtl:space-x-reverse">
              <input
                type="checkbox"
                id="extractSpecs"
                checked={extractSpecifications}
                onChange={(e) => setExtractSpecifications(e.target.checked)}
                className="mt-0.5 accent-indigo-500 rounded"
              />
              <label htmlFor="extractSpecs" className="text-slate-300 cursor-pointer">
                <span className="font-semibold block text-white mb-0.5">Specifications & Attributes</span>
                Extract key-value technical spec tables and nested accordion data.
              </label>
            </div>
          </div>

          <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 text-slate-400 space-y-1">
            <span className="text-indigo-400 font-semibold flex items-center space-x-1.5 rtl:space-x-reverse">
              <ShieldAlert className="w-4 h-4" />
              <span>Anti-Loop & Domain Lock Guard</span>
            </span>
            <p>
              The crawler maintains an in-memory SHA-256 fingerprint database to guarantee no URL is visited twice and no infinite loop occurs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
