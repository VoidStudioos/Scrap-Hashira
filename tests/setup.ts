import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Chrome API Mock for tests
const storageMock = {
  local: {
    get: vi.fn().mockImplementation((keys, cb) => cb ? cb({}) : Promise.resolve({})),
    set: vi.fn().mockImplementation((data, cb) => cb ? cb() : Promise.resolve()),
    remove: vi.fn().mockImplementation((keys, cb) => cb ? cb() : Promise.resolve()),
    clear: vi.fn().mockImplementation((cb) => cb ? cb() : Promise.resolve()),
  },
  sync: {
    get: vi.fn().mockImplementation((keys, cb) => cb ? cb({}) : Promise.resolve({})),
    set: vi.fn().mockImplementation((data, cb) => cb ? cb() : Promise.resolve()),
  },
};

const tabsMock = {
  query: vi.fn().mockImplementation((queryInfo, cb) => {
    const tabs = [{ id: 1, url: 'https://example.com/products', title: 'Example Products' }];
    if (cb) cb(tabs);
    return Promise.resolve(tabs);
  }),
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
  create: vi.fn().mockResolvedValue({ id: 2 }),
  update: vi.fn().mockResolvedValue({ id: 1 }),
};

const downloadsMock = {
  download: vi.fn().mockResolvedValue(100),
  search: vi.fn().mockResolvedValue([]),
};

const alarmsMock = {
  create: vi.fn(),
  clear: vi.fn(),
  onAlarm: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const runtimeMock = {
  id: 'hashira-scraper-test-id',
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  getURL: vi.fn((path: string) => `chrome-extension://hashira-test/${path}`),
};

// Global chrome object injection
(globalThis as any).chrome = {
  storage: storageMock,
  tabs: tabsMock,
  downloads: downloadsMock,
  alarms: alarmsMock,
  runtime: runtimeMock,
  sidePanel: {
    open: vi.fn(),
    setOptions: vi.fn(),
    setPanelBehavior: vi.fn().mockResolvedValue(undefined),
  },
};
