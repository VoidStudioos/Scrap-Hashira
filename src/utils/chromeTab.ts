// Safe Chrome Tab Messaging & Dynamic Injection Utility

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs) return null;
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      void chrome.runtime.lastError;
      resolve(tabs?.[0] || null);
    });
  });
}

export function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:')
  );
}

export async function ensureContentScriptReady(tabId: number): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.tabs) return false;

  return new Promise((resolve) => {
    // 1. Try sending PING to see if content script is active
    try {
      chrome.tabs.sendMessage(tabId, { action: 'PING' }, (res) => {
        void chrome.runtime.lastError;
        if (res && res.success) {
          resolve(true);
          return;
        }

        // 2. Content script not active. Dynamically inject content.js via scripting API!
        if (chrome.scripting) {
          chrome.scripting.executeScript(
            {
              target: { tabId },
              files: ['content.js'],
            },
            () => {
              void chrome.runtime.lastError;
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { action: 'PING' }, (retryRes) => {
                  void chrome.runtime.lastError;
                  resolve(Boolean(retryRes?.success));
                });
              }, 120);
            }
          );
        } else {
          resolve(false);
        }
      });
    } catch {
      resolve(false);
    }
  });
}

export async function sendTabMessage<T = any>(
  action: string,
  payload?: any
): Promise<{ success: boolean; data?: T; count?: number; items?: any[]; error?: string }> {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    return { success: false, error: 'NO_ACTIVE_TAB' };
  }

  if (isRestrictedUrl(tab.url)) {
    return { success: false, error: 'CHROME_INTERNAL' };
  }

  const isReady = await ensureContentScriptReady(tab.id);
  if (!isReady) {
    return { success: false, error: 'INJECTION_FAILED' };
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id!, { action, payload }, (res) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ success: false, error: err.message });
      } else if (res) {
        resolve(res);
      } else {
        resolve({ success: false, error: 'EMPTY_RESPONSE' });
      }
    });
  });
}
