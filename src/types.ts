export type JobState =
  'CREATED' | 'RUNNING' | 'PAUSED' | 'INTERRUPTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type TaskState = 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'BLOCKED';
export type ResourceState =
  'PENDING' | 'FETCHING' | 'FETCHED' | 'SAVING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
export type PageKind = 'category' | 'detail' | 'listing' | 'pagination' | 'document' | 'page';
export interface SelectorRule {
  css: string;
  xpath?: string;
  attribute?: string;
  semantic?: { attribute: string; value: string };
  label?: string;
  fingerprint?: string;
  transform?: 'text' | 'price' | 'code' | 'url';
}
export interface Profile {
  id: string;
  name: string;
  origin: string;
  patterns: string[];
  pageType: string;
  record: SelectorRule;
  fields: Record<string, SelectorRule>;
  pagination?: SelectorRule;
  gallery?: SelectorRule;
  detail?: SelectorRule;
  successes: number;
  failures: number;
  confidence: number;
  updatedAt: number;
  history: { at: number; count: number; valid: boolean }[];
}
export interface ExtractedRecord {
  id: string;
  jobId?: string;
  group: string;
  raw: Record<string, unknown>;
  fields: Record<string, unknown>;
  sourceUrl: string;
  imageUrls: string[];
  detailUrl?: string;
  confidence: number;
  completeness: number;
  categoryIds?: string[];
}
export interface ImageCandidate {
  url: string;
  sources: string[];
  width: number;
  height: number;
  role: 'product' | 'thumbnail' | 'logo' | 'icon' | 'banner' | 'decorative' | 'unknown';
  confidence: number;
  recordIds: string[];
  alternatives: string[];
}
export interface VideoCandidate {
  url: string;
  label: string;
  source: string;
  downloadable: boolean;
  limitation?: string;
}
export interface TableData {
  id: string;
  caption: string;
  headers: string[];
  rows: string[][];
  raw: string;
  normalized: string[][];
  sourceUrl: string;
}
export interface DiscoveredLink {
  url: string;
  text: string;
  kind: PageKind;
  parentUrl: string;
  depth: number;
}
export interface SchemaCandidate {
  id: string;
  selector: string;
  label: string;
  count: number;
  confidence: number;
  fields: string[];
}
export interface Detection {
  url: string;
  title: string;
  records: ExtractedRecord[];
  images: ImageCandidate[];
  videos?: VideoCandidate[];
  tables: TableData[];
  links: DiscoveredLink[];
  candidates: SchemaCandidate[];
  structured: unknown[];
  embedded: unknown[];
  metadata: Record<string, string>;
  fingerprint: string;
  adapter: string;
  semantic?: SemanticAnalysis;
  profileId?: string;
  profileValid?: boolean;
  profileResults?: { id: string; valid: boolean; count: number }[];
  warnings: string[];
  html?: string;
  text?: string;
  status?: number;
  authWall: boolean;
  next?: string;
  loadMore?: string;
}
export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  maxImages: number;
  pageConcurrency: number;
  downloadConcurrency: number;
  delayMs: number;
  retries: number;
  timeoutMs: number;
  memoryMB: number;
  maxResourceMB: number;
  include: string[];
  exclude: string[];
  branches: string[];
  fullCapture: boolean;
  downloadImages: boolean;
  downloadVideos?: boolean;
  maxVideos?: number;
  downloadDocuments: boolean;
  scrollSteps: number;
  loadMoreClicks: number;
  profileId?: string;
  candidateId?: string;
  performance: 'SAFE' | 'BALANCED' | 'FAST' | 'CUSTOM';
  approvedResourceOrigins: string[];
  apiPaths: string[];
  selectedImageUrls?: string[];
  exploreOnly?: boolean;
  traverse?: 'all' | 'details' | 'pagination' | 'categories';
  profileIds?: string[];
  candidateIds?: string[];
}
export interface Job {
  id: string;
  name: string;
  mode?: 'manual';
  state: JobState;
  startUrl: string;
  origin: string;
  config: CrawlConfig;
  createdAt: number;
  updatedAt: number;
  checkpoint: number;
  blockedUntil: number;
  cooldownUntil?: number;
  lastError?: string;
  robots?: { text: string; status: number };
  pageLimit?: number;
  downloadLimit?: number;
}
export interface PageTask {
  branchId?: string;
  id: string;
  jobId: string;
  url: string;
  parentUrl: string;
  kind: PageKind;
  depth: number;
  state: TaskState;
  attempts: number;
  nextAt: number;
  leaseUntil?: number;
  owner?: string;
  tabId?: number;
  fingerprint?: string;
  error?: string;
}
export interface CategoryNode {
  id: string;
  label: string;
  code?: string;
  href?: string;
  parentId?: string;
  path: string[];
  sourceUrl: string;
  source: 'tree' | 'navigation' | 'breadcrumb' | 'record' | 'page' | 'list' | 'manual';
  collapsed?: boolean;
  confidence: number;
}
export interface TypedField {
  id: string;
  raw: string;
  label: string;
  value: string | number;
  kind: 'code' | 'price' | 'quantity' | 'number' | 'text' | 'link';
  confidence: number;
  evidence: string;
  sourceUrl: string;
  categoryId: string;
  recordId?: string;
}
export interface ImageLink {
  id: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  targetUrl?: string;
  relation:
    | 'direct-image'
    | 'candidate-image'
    | 'detail-page'
    | 'unverified-target'
    | 'interaction-required'
    | 'inline-image';
  recordIds: string[];
  categoryId: string;
  confidence: number;
  evidence: string;
}
export interface SemanticAnalysis {
  categories: CategoryNode[];
  fields: TypedField[];
  imageLinks: ImageLink[];
  warnings: string[];
}
export interface PageSnapshot {
  videos?: VideoCandidate[];
  semantic?: SemanticAnalysis;
  id: string;
  jobId: string;
  url: string;
  title: string;
  at: number;
  fingerprint: string;
  html?: string;
  text?: string;
  metadata: Record<string, string>;
  structured: unknown[];
  embedded: unknown[];
  tables: TableData[];
  links: DiscoveredLink[];
  warnings: string[];
}
export interface ResourceTask {
  id: string;
  jobId: string;
  url: string;
  kind: 'image' | 'document' | 'video';
  validation?: 'decoded' | 'signature-only';
  recordIds: string[];
  branchPath?: string[];
  state: ResourceState;
  attempts: number;
  nextAt: number;
  owner?: string;
  leaseUntil?: number;
  hash?: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
  filename?: string;
  downloadId?: number;
  blobUrl?: string;
  error?: string;
}
export interface BlobEntry {
  hash: string;
  blob: Blob;
  mime: string;
  size: number;
}
export interface LogEntry {
  id?: number;
  jobId: string;
  at: number;
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  url?: string;
}
export interface SelectedElement {
  url: string;
  group: string;
  css: string;
  xpath: string;
  text: string;
  attribute?: string;
  semantic?: SelectorRule['semantic'];
  fingerprint: string;
  repeated: string;
  count: number;
}
export const DEFAULT_CONFIG: CrawlConfig = {
  maxPages: 30,
  maxDepth: 2,
  maxImages: 500,
  pageConcurrency: 1,
  downloadConcurrency: 3,
  delayMs: 1200,
  retries: 2,
  timeoutMs: 20000,
  memoryMB: 256,
  maxResourceMB: 20,
  include: [],
  exclude: [],
  branches: [],
  fullCapture: false,
  downloadImages: true,
  downloadVideos: true,
  maxVideos: 100,
  downloadDocuments: false,
  scrollSteps: 0,
  loadMoreClicks: 0,
  performance: 'BALANCED',
  approvedResourceOrigins: [],
  apiPaths: [],
};
export interface Settings {
  language: 'en' | 'fa';
  theme: 'dark' | 'light';
  config: CrawlConfig;
}
export type Response<T> = { ok: true; data: T } | { ok: false; error: string };
