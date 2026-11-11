import React from 'react';
import { createRoot } from 'react-dom/client';
import '../sidepanel/style.css';
function Popup() {
  const [error, setError] = React.useState('');
  const open = () => {
    void chrome.sidePanel
      .open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
      .then(() => window.close())
      .catch((e) => setError(String(e)));
  };
  return (
    <main className="popup">
      <div className="brand-mark">H</div>
      <h1>
        Hashira<span>Scraper</span>
      </h1>
      <p>Extract data. Keep the images.</p>
      <button onClick={open}>Open workspace ↗</button>
      <small>Local-first · Site-scoped · Resumable</small>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Popup />);
