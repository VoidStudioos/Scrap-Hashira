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

  scanActiveTab: async () => {
    set({ isScanning: true });
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (!tabs[0]?.id) {
            set({ isScanning: false });
            return;
          }

          chrome.tabs.sendMessage(tabs[0].id, { action: 'DETECT_PAGE_DATA' }, (response) => {
            if (response && response.success && response.data) {
              set({
                detectedSchemas: response.data.schemas || [],
                detectedTables: response.data.tables || [],
                isScanning: false,
              });
            } else {
              set({ isScanning: false });
            }
          });
        });
      } else {
        set({ isScanning: false });
      }
    } catch {
      set({ isScanning: false });
    }
  },

  startOneClickJob: async (schema: CandidateSchema) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      const url = activeTab?.url || 'https://example.com';
      const job = await StorageService.createJob(url, `Scrape: ${schema.title}`, get().performanceConfig);

      set({ activeJob: job });
      await StorageService.updateJobState(job.id, 'RUNNING');

      // Request live content extraction from page
      if (activeTab?.id) {
        chrome.tabs.sendMessage(
          activeTab.id,
          {
            action: 'EXTRACT_BY_RULES',
            payload: {
              recordSelector: schema.recordSelector,
              fieldSelectors: schema.fields,
              jobId: job.id,
            },
          },
          async (res) => {
            if (res && res.success && res.data) {
              await StorageService.addRecords(res.data);
              await StorageService.updateJobState(job.id, 'COMPLETED');
              await get().loadJobs();
            }
          }
        );
      }
    });
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

  setVisualSelectorActive: (active: boolean) => {
    set({ visualSelectorActive: active });
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: active ? 'START_VISUAL_SELECTOR' : 'STOP_VISUAL_SELECTOR',
          });
        }
      });
    }
  },

  setVisualSelectorData: (data: any) => {
    set({ visualSelectorData: data });
  },
}));
