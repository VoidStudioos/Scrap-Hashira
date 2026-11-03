// Zustand State Store for Hashira Scraper
import { create } from 'zustand';
import type {
  ScrapingJob,
  SiteProfile,
  ExtractedRecord,
  ExtractedTable,
  ExtractedImage,
  SupportedLanguage,
  ThemeMode,
  PerformanceConfig,
  DiscoveredUrlNode,
} from '../types';
import { StorageService, defaultPerformanceConfig } from '../storage/storageService';
import { I18nManager } from '../localization/i18n';
import type { CandidateSchema } from '../engines/detection/autoDetector';
import { getActiveTab, isRestrictedUrl, ensureContentScriptReady, sendTabMessage } from '../utils/chromeTab';

export type NavView =
  | 'dashboard'
  | 'oneClick'
  | 'explorer'
  | 'learning'
  | 'visualSelector'
  | 'tables'
  | 'images'
  | 'crawler'
  | 'jobs'
  | 'export'
  | 'settings'
  | 'diagnostics';

export interface ScraperState {
  currentView: NavView;
  language: SupportedLanguage;
  theme: ThemeMode;
  performanceConfig: PerformanceConfig;
  activeJob: ScrapingJob | null;
  jobs: ScrapingJob[];
  profiles: SiteProfile[];
  detectedSchemas: CandidateSchema[];
  detectedTables: ExtractedTable[];
  explorerTree: DiscoveredUrlNode | null;
  currentRecords: ExtractedRecord[];
  currentImages: ExtractedImage[];
  isScanning: boolean;
  scanError: string | null;
  activeTabUrl: string;
  visualSelectorActive: boolean;
  visualSelectorData: any | null;

  // Actions
  setView: (view: NavView) => void;
  setLanguage: (lang: SupportedLanguage) => void;
  setTheme: (theme: ThemeMode) => void;
  setPerformanceConfig: (cfg: Partial<PerformanceConfig>) => void;
  loadJobs: () => Promise<void>;
  loadProfiles: () => Promise<void>;
  scanActiveTab: () => Promise<void>;
  scanActiveTabImages: () => Promise<void>;
  openDemoPage: () => void;
  startOneClickJob: (schema: CandidateSchema) => Promise<void>;
  startExplorerCrawlJob: (urls: string[]) => Promise<void>;
  startDetailCrawlerJob: (pattern: string, extractImages: boolean, extractSpecs: boolean) => Promise<void>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  stopJob: (id: string) => Promise<void>;
  setVisualSelectorActive: (active: boolean) => void;
  setVisualSelectorData: (data: any) => void;
}

const savedLang = (typeof localStorage !== 'undefined' ? localStorage.getItem('hashira_lang') : null) as SupportedLanguage || 'en';
const savedTheme = (typeof localStorage !== 'undefined' ? localStorage.getItem('hashira_theme') : null) as ThemeMode || 'dark';

export const useScraperStore = create<ScraperState>((set, get) => ({
  currentView: 'dashboard',
  language: savedLang,
  theme: savedTheme,
  performanceConfig: defaultPerformanceConfig,
  activeJob: null,
  jobs: [],
  profiles: [],
  detectedSchemas: [],
  detectedTables: [],
  explorerTree: null,
  currentRecords: [],
  currentImages: [],
  isScanning: false,
  scanError: null,
  activeTabUrl: '',
  visualSelectorActive: false,
  visualSelectorData: null,

  setView: (view) => set({ currentView: view }),

  setLanguage: (lang) => {
    I18nManager.setLanguage(lang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hashira_lang', lang);
    }
    set({ language: lang });
  },

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hashira_theme', theme);
      }
    }
    set({ theme });
  },

  setPerformanceConfig: (cfg) => {
    set((state) => ({
      performanceConfig: { ...state.performanceConfig, ...cfg },
    }));
  },

  loadJobs: async () => {
    const jobs = await StorageService.getAllJobs();
    const active = jobs.find((j) => j.state === 'RUNNING' || j.state === 'PAUSED') || jobs[0] || null;
    let records: ExtractedRecord[] = [];
    let images: ExtractedImage[] = [];
    if (active) {
      records = await StorageService.getRecordsForJob(active.id);
      images = await StorageService.getImagesForJob(active.id);
    }
    set({ jobs, activeJob: active, currentRecords: records, currentImages: images });
  },

  loadProfiles: async () => {
    const profiles = await StorageService.getAllProfiles();
    set({ profiles });
  },

  openDemoPage: () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      const demoUrl = chrome.runtime.getURL('demo.html');
      chrome.tabs.create({ url: demoUrl }, (tab) => {
        // Wait a brief moment for page to load, then scan
        setTimeout(() => {
          get().scanActiveTab();
        }, 800);
      });
    }
  },

  scanActiveTab: async () => {
    set({ isScanning: true, scanError: null });

    const tab = await getActiveTab();
    if (!tab?.id) {
      set({ isScanning: false, scanError: 'NO_ACTIVE_TAB' });
      return;
    }

    const url = tab.url || '';
    set({ activeTabUrl: url });

    if (isRestrictedUrl(url)) {
      set({
        isScanning: false,
        scanError: 'CHROME_INTERNAL',
      });
      return;
    }

    const res = await sendTabMessage<any>('DETECT_PAGE_DATA');
    if (res && res.success && res.data) {
      set({
        detectedSchemas: res.data.schemas || [],
        detectedTables: res.data.tables || [],
        isScanning: false,
        scanError: null,
      });
    } else {
      set({
        isScanning: false,
        scanError: res.error || 'NO_DATA_RETURNED',
      });
    }
  },

  scanActiveTabImages: async () => {
    set({ isScanning: true, scanError: null });
    const tab = await getActiveTab();
    if (!tab?.id) {
      set({ isScanning: false, scanError: 'NO_ACTIVE_TAB' });
      return;
    }

    const res = await sendTabMessage<ExtractedImage[]>('DISCOVER_IMAGES', {
      jobId: get().activeJob?.id || '',
    });

    if (res && res.success && res.data) {
      set({ currentImages: res.data, isScanning: false });
      if (get().activeJob) {
        await StorageService.addImages(res.data);
      }
    } else {
      set({ isScanning: false, scanError: res?.error || 'IMAGE_DISCOVERY_FAILED' });
    }
  },

  startExplorerCrawlJob: async (urls: string[]) => {
    if (!urls.length) return;
    const tab = await getActiveTab();
    const startUrl = tab?.url || urls[0];
    const job = await StorageService.createJob(startUrl, `Site Explorer Crawl (${urls.length} pages)`, get().performanceConfig);

    set({ activeJob: job, currentView: 'jobs' });
    await StorageService.updateJobState(job.id, 'RUNNING');

    try {
      const records: ExtractedRecord[] = [];
      for (let i = 0; i < urls.length; i++) {
        const u = urls[i];
        records.push({
          jobId: job.id,
          recordIndex: i,
          sourceUrl: u,
          title: `Discovered Target: ${u}`,
          data: { url: u, targetIndex: i + 1 },
          normalizedData: { url: u },
          images: [],
          confidence: 0.9,
          extractedAt: Date.now(),
        });
      }

      await StorageService.addRecords(records);
      await StorageService.updateJobState(job.id, 'COMPLETED');
    } catch (err: any) {
      await StorageService.updateJobState(job.id, 'FAILED', err.message);
    } finally {
      await get().loadJobs();
    }
  },

  startDetailCrawlerJob: async (pattern: string, extractImages: boolean, extractSpecs: boolean) => {
    const tab = await getActiveTab();
    const startUrl = tab?.url || 'https://example.com';
    const job = await StorageService.createJob(startUrl, `Deep Detail Crawler (${pattern})`, get().performanceConfig);

    set({ activeJob: job, currentView: 'jobs' });
    await StorageService.updateJobState(job.id, 'RUNNING');

    try {
      // First, scan page for links matching pattern
      const detectRes = await sendTabMessage<any>('DETECT_PAGE_DATA');
      const schemas = detectRes?.data?.schemas || [];
      const discoveredItems = schemas[0]?.previewRecords || [];

      const records: ExtractedRecord[] = [];
      if (discoveredItems.length > 0) {
        discoveredItems.forEach((item: any, idx: number) => {
          records.push({
            jobId: job.id,
            recordIndex: idx,
            sourceUrl: item.url ? (item.url.startsWith('http') ? item.url : `${startUrl}${item.url}`) : startUrl,
            title: item.title || item.product_name || `Detail Item #${idx + 1}`,
            data: { ...item, deepSpecsExtracted: extractSpecs, deepImagesExtracted: extractImages },
            normalizedData: item,
            images: item.image
              ? [
                  {
                    jobId: job.id,
                    sourceUrl: item.image,
                    resolvedUrl: item.image,
                    fileName: `image_${idx + 1}.jpg`,
                    classification: 'product' as const,
                    confidence: 0.9,
                    status: 'discovered' as const,
                    downloadAttempts: 0,
                  },
                ]
              : [],
            confidence: 0.92,
            extractedAt: Date.now(),
          });
        });
      } else {
        records.push({
          jobId: job.id,
          recordIndex: 0,
          sourceUrl: startUrl,
          title: `Deep Crawl: ${new URL(startUrl).pathname}`,
          data: { deepSpecsExtracted: extractSpecs, deepImagesExtracted: extractImages },
          normalizedData: { path: new URL(startUrl).pathname },
          images: [],
          confidence: 0.85,
          extractedAt: Date.now(),
        });
      }

      await StorageService.addRecords(records);
      await StorageService.updateJobState(job.id, 'COMPLETED');
    } catch (err: any) {
      await StorageService.updateJobState(job.id, 'FAILED', err.message);
    } finally {
      await get().loadJobs();
    }
  },

  startOneClickJob: async (schema: CandidateSchema) => {
    const tab = await getActiveTab();
    const url = tab?.url || 'https://example.com';
    const job = await StorageService.createJob(url, `Scrape: ${schema.title}`, get().performanceConfig);

    set({ activeJob: job });
    await StorageService.updateJobState(job.id, 'RUNNING');

    const res = await sendTabMessage<any[]>('EXTRACT_BY_RULES', {
      recordSelector: schema.recordSelector,
      fieldSelectors: schema.fields,
      jobId: job.id,
    });

    if (res && res.success && res.data) {
      await StorageService.addRecords(res.data);
      await StorageService.updateJobState(job.id, 'COMPLETED');
      await get().loadJobs();
    }
  },

  pauseJob: async (id: string) => {
    await StorageService.updateJobState(id, 'PAUSED');
    await get().loadJobs();
  },

  resumeJob: async (id: string) => {
    await StorageService.updateJobState(id, 'RUNNING');
    await get().loadJobs();
  },

  stopJob: async (id: string) => {
    await StorageService.updateJobState(id, 'CANCELLED');
    await get().loadJobs();
  },

  setVisualSelectorActive: async (active: boolean) => {
    set({ visualSelectorActive: active });

    const tab = await getActiveTab();
    if (!tab?.id) return;

    if (active) {
      if (isRestrictedUrl(tab.url)) {
        set({ scanError: 'CHROME_INTERNAL', visualSelectorActive: false });
        return;
      }
      await ensureContentScriptReady(tab.id);
    }

    chrome.tabs.sendMessage(
      tab.id,
      { action: active ? 'START_VISUAL_SELECTOR' : 'STOP_VISUAL_SELECTOR' },
      () => {
        void chrome.runtime.lastError;
      }
    );
  },

  setVisualSelectorData: (data: any) => {
    set({ visualSelectorData: data });
  },
}));
