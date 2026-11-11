import { canonical, validateConfig } from '../security/policy';
import { create } from 'zustand';
import type { CrawlConfig, Detection, Settings, Response } from '../types';
import { DEFAULT_CONFIG } from '../types';
export interface UIState {
  nav: string;
  settings: Settings;
  detection?: Detection;
  tabId?: number;
  url: string;
  busy: boolean;
  notice: string;
  config: CrawlConfig;
  set: (value: Partial<UIState>) => void;
}
export const useUI = create<UIState>((set) => ({
  nav: 'dashboard',
  settings: { theme: 'dark', language: 'en', config: DEFAULT_CONFIG },
  url: '',
  busy: false,
  notice: '',
  config: DEFAULT_CONFIG,
  set,
}));
export function selectPage(tabId: number, url: string) {
  const state = useUI.getState();
  if (state.tabId === tabId && canonical(state.url) === canonical(url)) return;
  const originChanged = !state.url || new URL(state.url).origin !== new URL(url).origin;
  useUI.setState({
    tabId,
    url,
    detection: undefined,
    config: {
      ...state.config,
      candidateId: undefined,
      candidateIds: [],
      selectedImageUrls: undefined,
      ...(originChanged ? { branches: [], profileId: undefined, profileIds: [] } : {}),
    },
  });
}
export async function command<T = unknown>(
  op: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const response = (await chrome.runtime.sendMessage({
    target: 'background',
    op,
    ...data,
  })) as Response<T>;
  if (!response?.ok)
    throw new Error(response && !response.ok ? response.error : 'Extension worker unavailable');
  return response.data;
}
export async function loadSettings() {
  const saved = await chrome.storage.local.get('settings');
  if (saved.settings) {
    const candidate = saved.settings as Settings;
    const settings: Settings = {
      language: candidate.language === 'fa' ? 'fa' : 'en',
      theme: candidate.theme === 'light' ? 'light' : 'dark',
      config: validateConfig(candidate.config || {}),
    };
    useUI.setState({
      settings: { ...settings, config: { ...DEFAULT_CONFIG, ...settings.config } },
      config: { ...DEFAULT_CONFIG, ...settings.config },
    });
  }
}
export async function saveSettings(settings: Settings) {
  const safe = { ...settings, config: validateConfig(settings.config) };
  await chrome.storage.local.set({ settings: safe });
  useUI.setState({ settings: safe });
}
