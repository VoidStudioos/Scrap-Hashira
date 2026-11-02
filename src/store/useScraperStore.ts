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
  openDemoPage: () => void;
  startOneClickJob: (schema: CandidateSchema) => Promise<void>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  stopJob: (id: string) => Promise<void>;
  setVisualSelectorActive: (active: boolean) => void;
  setVisualSelectorData: (data: any) => void;
}

export const useScraperStore = create<ScraperState>((set, get) => ({
  currentView: 'dashboard',
  language: 'en',
  theme: 'dark',
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
    set({ language: lang });
  },

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
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
