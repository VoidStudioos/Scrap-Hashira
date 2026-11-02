// Hashira Scraper MV3 Service Worker
import { StorageService } from '../storage/storageService';
import { ResumeEngine } from '../engines/resume/resumeEngine';

// Open side panel on action click if supported
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

// Watchdog alarm on startup
ResumeEngine.setupWatchdog();

// Service Worker startup listener
chrome.runtime.onInstalled.addListener(async () => {
  await StorageService.log(undefined, 'info', 'Hashira Scraper extension installed successfully.');
  await ResumeEngine.checkAndRecoverInterruptedJobs();
});

// Relaying messages between side panel, popup, and active content tabs
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { action, payload } = message;

  switch (action) {
    case 'PING':
      sendResponse({ success: true, timestamp: Date.now() });
      return;

    case 'OPEN_SIDEPANEL':
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          void chrome.runtime.lastError;
          if (tabs[0]?.id) {
            chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
          }
        });
      }
      sendResponse({ success: true });
      return;

    case 'SEND_TO_ACTIVE_TAB': {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        void chrome.runtime.lastError;
        if (!tabs[0]?.id) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        try {
          const tabId = tabs[0].id;
          const res = await chrome.tabs.sendMessage(tabId, payload);
          sendResponse({ success: true, data: res });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'Failed to send' });
        }
      });
      return true;
    }

    default:
      return;
  }
});
