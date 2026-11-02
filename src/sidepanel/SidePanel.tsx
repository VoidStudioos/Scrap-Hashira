import React, { useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Dashboard } from '../components/Dashboard';
import { OneClickScraper } from '../components/OneClickScraper';
import { SmartSiteExplorer } from '../components/SmartSiteExplorer';
import { SmartLearning } from '../components/SmartLearning';
import { VisualSelectorPanel } from '../components/VisualSelectorPanel';
import { TableExtractor } from '../components/TableExtractor';
import { ImageCollector } from '../components/ImageCollector';
import { DetailPageCrawler } from '../components/DetailPageCrawler';
import { JobsManager } from '../components/JobsManager';
import { ExportCenter } from '../components/ExportCenter';
import { Settings } from '../components/Settings';
import { Diagnostics } from '../components/Diagnostics';
import { useScraperStore } from '../store/useScraperStore';
import { I18nManager } from '../localization/i18n';

export const SidePanel: React.FC = () => {
  const { currentView, theme, language } = useScraperStore();

  useEffect(() => {
    I18nManager.setLanguage(language);
  }, [language]);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'oneClick':
        return <OneClickScraper />;
      case 'explorer':
        return <SmartSiteExplorer />;
      case 'learning':
        return <SmartLearning />;
      case 'visualSelector':
        return <VisualSelectorPanel />;
      case 'tables':
        return <TableExtractor />;
      case 'images':
        return <ImageCollector />;
      case 'crawler':
        return <DetailPageCrawler />;
      case 'jobs':
        return <JobsManager />;
      case 'export':
        return <ExportCenter />;
      case 'settings':
        return <Settings />;
      case 'diagnostics':
        return <Diagnostics />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div
      className={`min-h-screen flex ${
        theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
      dir={I18nManager.getDirection()}
    >
      <Navbar />
      <main className="flex-1 overflow-y-auto max-h-screen">{renderContent()}</main>
    </div>
  );
};
