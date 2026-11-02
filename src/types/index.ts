// Hashira Scraper Core Type Definitions

export type JobState =
  | 'CREATED'
  | 'RUNNING'
  | 'PAUSED'
  | 'INTERRUPTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type PerformanceMode = 'SAFE' | 'BALANCED' | 'FAST' | 'CUSTOM';

export interface PerformanceConfig {
  mode: PerformanceMode;
  maxConcurrentPages: number;
  maxConcurrentDownloads: number;
  requestDelayMs: number;
  retryCount: number;
  timeoutMs: number;
  maxCrawlDepth: number;
  maxPages: number;
  maxImages: number;
  memoryBudgetMb: number;
}

export interface SelectorRule {
  field: string;
  cssSelector: string;
  xpathFallback?: string;
  attribute?: 'text' | 'html' | 'src' | 'href' | string;
  confidence: number;
  isCustom?: boolean;
}

export interface SiteProfile {
  id?: number;
  domain: string;
  name: string;
  pageType: 'catalog' | 'detail' | 'table' | 'generic';
  urlPattern: string;
  recordSelector: string;
  fieldSelectors: SelectorRule[];
  paginationRule?: {
    type: 'next_button' | 'numbered' | 'load_more' | 'infinite_scroll';
    selector?: string;
  };
  detailPageRule?: {
    linkSelector: string;
    followDepth: number;
  };
  imageGalleryRule?: {
    gallerySelector: string;
    itemSelector: string;
  };
  domFingerprint?: string;
  successCount: number;
  failureCount: number;
  confidenceScore: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExtractedImage {
  id?: number;
  jobId: string;
  recordId?: string;
  sourceUrl: string;
  resolvedUrl: string;
  localPath?: string;
  fileName: string;
  mimeType?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  hashSha256?: string;
  classification: 'product' | 'thumbnail' | 'logo' | 'icon' | 'banner' | 'decorative';
  confidence: number;
  status: 'discovered' | 'downloading' | 'completed' | 'failed' | 'skipped';
  error?: string;
  downloadAttempts: number;
}

export interface ExtractedRecord {
  id?: number;
  jobId: string;
  recordIndex: number;
  sourceUrl: string;
  title: string;
  data: Record<string, any>;
  rawHtml?: string;
  images: ExtractedImage[];
  extractedAt: number;
  normalizedData: Record<string, any>;
  confidence: number;
}

export interface ExtractedTable {
  id?: number;
  jobId: string;
  sourceUrl: string;
  tableIndex: number;
  title?: string;
  headers: string[];
  rows: (string | number)[][];
  rawHtml?: string;
  hasNestedTables: boolean;
  extractedAt: number;
}

export interface CrawlQueueItem {
  id?: number;
  jobId: string;
  url: string;
  depth: number;
  type: 'catalog' | 'detail' | 'pagination';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  discoveredAt: number;
  processedAt?: number;
  retryCount: number;
  error?: string;
}

export interface JobCheckpoint {
  jobId: string;
  state: JobState;
  processedPagesCount: number;
  pendingPagesCount: number;
  completedRecordsCount: number;
  completedDownloadsCount: number;
  failedDownloadsCount: number;
  lastUrlProcessed: string;
  timestamp: number;
}

export interface ScrapingJob {
  id: string; // UUID or timestamp id
  name: string;
  startingUrl: string;
  state: JobState;
  config: PerformanceConfig;
  profileId?: number;
  stats: {
    pagesDiscovered: number;
    pagesProcessed: number;
    recordsExtracted: number;
    tablesExtracted: number;
    imagesDiscovered: number;
    imagesDownloaded: number;
    downloadFailures: number;
    storageUsedBytes: number;
  };
  errorHistory: { timestamp: number; message: string; url?: string }[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface DiscoveredUrlNode {
  url: string;
  label: string;
  type:
    | 'category'
    | 'subcategory'
    | 'listing'
    | 'detail'
    | 'pagination'
    | 'gallery'
    | 'document'
    | 'internal'
    | 'external';
  depth: number;
  selected: boolean;
  children?: DiscoveredUrlNode[];
}

export interface LogEntry {
  id?: number;
  jobId?: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: any;
  timestamp: number;
}

export interface DiagnosticItem {
  category: string;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  value: string | number | boolean;
  message: string;
}

export type SupportedLanguage = 'en' | 'fa';
export type ThemeMode = 'dark' | 'light';
