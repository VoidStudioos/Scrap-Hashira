import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Compass,
  Brain,
  MousePointerClick,
  Table,
  Image as ImageIcon,
  FolderGit2,
  Layers,
  DownloadCloud,
  Settings as SettingsIcon,
  Activity,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { useScraperStore, type NavView } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';

export const Navbar: React.FC = () => {
  const { currentView, setView, theme, setTheme, language, setLanguage } = useScraperStore();

  const navItems: { view: NavView; labelKey: any; icon: React.ReactNode }[] = [
    { view: 'dashboard', labelKey: 'dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { view: 'oneClick', labelKey: 'oneClickScraper', icon: <Zap className="w-4 h-4 text-amber-500" /> },
    { view: 'explorer', labelKey: 'smartSiteExplorer', icon: <Compass className="w-4 h-4 text-cyan-500" /> },
    { view: 'learning', labelKey: 'smartLearning', icon: <Brain className="w-4 h-4 text-purple-500" /> },
    { view: 'visualSelector', labelKey: 'visualSelector', icon: <MousePointerClick className="w-4 h-4 text-emerald-500" /> },
    { view: 'tables', labelKey: 'tableExtractor', icon: <Table className="w-4 h-4 text-blue-500" /> },
    { view: 'images', labelKey: 'imageCollector', icon: <ImageIcon className="w-4 h-4 text-rose-500" /> },
    { view: 'crawler', labelKey: 'detailPageCrawler', icon: <FolderGit2 className="w-4 h-4 text-indigo-500" /> },
    { view: 'jobs', labelKey: 'jobsManager', icon: <Layers className="w-4 h-4 text-orange-500" /> },
    { view: 'export', labelKey: 'exportCenter', icon: <DownloadCloud className="w-4 h-4 text-teal-500" /> },
    { view: 'settings', labelKey: 'settings', icon: <SettingsIcon className="w-4 h-4 text-slate-400" /> },
    { view: 'diagnostics', labelKey: 'diagnostics', icon: <Activity className="w-4 h-4 text-red-500" /> },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col flex-shrink-0 min-h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-slate-950 text-lg shadow-md shadow-teal-500/20">
            H
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-white">Hashira Scraper</h1>
            <p className="text-[10px] text-teal-400 font-mono">v2.0 PRO LOCAL</p>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={`w-full flex items-center space-x-3 rtl:space-x-reverse px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {item.icon}
              <span className="truncate">{I18nManager.t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Controls: Language & Theme */}
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}
          className="flex items-center space-x-1 rtl:space-x-reverse hover:text-white px-2 py-1 rounded bg-slate-800"
          title="Switch Language"
        >
          <Globe className="w-3.5 h-3.5 text-teal-400" />
          <span className="font-semibold">{language === 'en' ? 'فارسی' : 'English'}</span>
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded bg-slate-800 hover:text-white"
          title="Toggle Dark/Light Mode"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
        </button>
      </div>
    </aside>
  );
};
