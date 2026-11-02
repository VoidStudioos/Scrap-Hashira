import React, { useState } from 'react';
import {
  Compass,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  Play,
  Globe,
  Filter,
} from 'lucide-react';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';
import type { DiscoveredUrlNode } from '../types';
import { SiteExplorer } from '../engines/explorer/siteExplorer';
import { sendTabMessage } from '../utils/chromeTab';

export const SmartSiteExplorer: React.FC = () => {
  const { explorerTree, performanceConfig, setPerformanceConfig, setView } = useScraperStore();
  const [tree, setTree] = useState<DiscoveredUrlNode | null>(explorerTree);
  const [isExploring, setIsExploring] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['categories', 'listings', 'details']));

  const handleExplore = async () => {
    setIsExploring(true);
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const res = await sendTabMessage<any>('EXPLORE_SITE', {
        maxPages: performanceConfig.maxPages,
        stayOnDomain: true,
      });
      setIsExploring(false);
      if (res && res.success && res.data) {
        setTree(res.data);
      }
    } else {
      // Local fallback mock exploration
      setTimeout(() => {
        setIsExploring(false);
        const sampleTree = SiteExplorer.explorePage(document, window.location.href);
        setTree(sampleTree);
      }, 600);
    }
  };

  const toggleExpand = (key: string) => {
    const next = new Set(expandedNodes);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedNodes(next);
  };

  const toggleSelect = (node: DiscoveredUrlNode) => {
    node.selected = !node.selected;
    if (node.children) {
      const setChildren = (n: DiscoveredUrlNode, val: boolean) => {
        n.selected = val;
        n.children?.forEach((c) => setChildren(c, val));
      };
      node.children.forEach((c) => setChildren(c, node.selected));
    }
    setTree({ ...tree! });
  };

  const handleStartCrawl = () => {
    if (!tree) return;
    const selectedUrls = SiteExplorer.getSelectedUrls(tree);
    if (selectedUrls.length === 0) {
      alert('Please select at least one branch or URL to crawl.');
      return;
    }
    setView('jobs');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
            <Compass className="w-5 h-5 text-cyan-400" />
            <span>{I18nManager.t('smartSiteExplorer')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Build a visual discovery sitemap, classify URL branches, and select targets.
          </p>
        </div>

        <button
          onClick={handleExplore}
          disabled={isExploring}
          className="flex items-center space-x-2 rtl:space-x-reverse bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition shadow disabled:opacity-50"
        >
          <Compass className="w-4 h-4" />
          <span>{isExploring ? 'Exploring Site Structure...' : I18nManager.t('exploreSite')}</span>
        </button>
      </div>

      {/* Crawl Parameters Bar */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="text-slate-400 block mb-1">Max Depth: {performanceConfig.maxCrawlDepth}</label>
          <input
            type="range"
            min="1"
            max="5"
            value={performanceConfig.maxCrawlDepth}
            onChange={(e) => setPerformanceConfig({ maxCrawlDepth: parseInt(e.target.value, 10) })}
            className="w-full accent-cyan-500"
          />
        </div>

        <div>
          <label className="text-slate-400 block mb-1">Page Limit: {performanceConfig.maxPages}</label>
          <input
            type="range"
            min="10"
            max="500"
            step="10"
            value={performanceConfig.maxPages}
            onChange={(e) => setPerformanceConfig({ maxPages: parseInt(e.target.value, 10) })}
            className="w-full accent-cyan-500"
          />
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse mt-4 sm:mt-0">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300 font-medium">Domain Locked (No external crawl)</span>
        </div>
      </div>

      {/* Visual Tree */}
      {!tree ? (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-12 text-center space-y-3">
          <Globe className="w-10 h-10 text-cyan-500/50 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">Website Structure Not Discovered</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click "Explore Site" to analyze links, categories, product catalogs, and documents.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <Folder className="w-4 h-4 text-cyan-400" />
              <span>{tree.label}</span>
            </h3>

            <button
              onClick={handleStartCrawl}
              className="flex items-center space-x-1.5 rtl:space-x-reverse bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Crawl Selected Branches</span>
            </button>
          </div>

          {/* Tree Branches */}
          <div className="space-y-2">
            {tree.children?.map((group, gIdx) => {
              const isExpanded = expandedNodes.has(group.type);
              const itemCount = group.children?.length || 0;

              return (
                <div key={gIdx} className="border border-slate-700/60 rounded-lg overflow-hidden">
                  <div className="bg-slate-800/80 px-3 py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <button onClick={() => toggleExpand(group.type)} className="text-slate-400 hover:text-white">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <button onClick={() => toggleSelect(group)} className="text-slate-400 hover:text-cyan-400">
                        {group.selected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4" />}
                      </button>
                      <span className="font-semibold text-slate-200">{group.label}</span>
                      <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded font-mono">
                        {itemCount}
                      </span>
                    </div>
                  </div>

                  {isExpanded && group.children && (
                    <div className="p-2 bg-slate-900/60 space-y-1 max-h-60 overflow-y-auto">
                      {group.children.map((child, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center space-x-2 rtl:space-x-reverse text-xs text-slate-300 hover:bg-slate-800/50 px-2 py-1 rounded"
                        >
                          <button onClick={() => toggleSelect(child)} className="text-slate-400 hover:text-cyan-400">
                            {child.selected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                          </button>
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate flex-1" title={child.url}>
                            {child.label || child.url}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
