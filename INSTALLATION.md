# Hashira Scraper — Installation Guide

## System Requirements

- **Operating System**: Windows 10/11, macOS, or Linux.
- **Browser**: Google Chrome version 114+ (or any Chromium browser supporting Manifest V3 and Side Panel API, such as Brave, Edge, or Vivaldi).
- **Node.js**: Version 18.0+ (Node 20+ or 24 recommended).
- **Package Manager**: npm, pnpm, or yarn.

---

## Method 1: Installing the Pre-Built ZIP Package (Fastest)

1. Locate the package file in the project directory:
   ```
   hashira-scraper-v2.0.0.zip
   ```
2. Extract `hashira-scraper-v2.0.0.zip` to a folder on your computer (e.g. `C:\HashiraScraper`).
3. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
4. Toggle on **Developer mode** in the top-right corner.
5. Click the **Load unpacked** button in the top-left corner.
6. Select the extracted folder containing `manifest.json`.
7. Hashira Scraper is now installed! Pin the extension to your Chrome toolbar.

---

## Method 2: Building From Source Code

1. Open PowerShell or Terminal in the extension directory:
   ```powershell
   cd c:\Users\Administrator\Desktop\AG\Extension
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Run the automated tests to verify your environment:
   ```powershell
   npm test
   ```

4. Build the production extension:
   ```powershell
   npm run build
   ```
   This generates the optimized `dist/` directory containing:
   - `dist/manifest.json`
   - `dist/popup.html`
   - `dist/sidepanel.html`
   - `dist/background.js` (MV3 Service Worker)
   - `dist/content.js` (Standalone IIFE Content Script)
   - `dist/assets/` (React UI, styles, icons)

5. Open Chrome, go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `dist` directory.

---

## Using Hashira Scraper

1. Navigate to any website you want to scrape (e.g., an e-commerce catalog or table).
2. Click the **Hashira Scraper** icon in your browser toolbar.
3. Choose **Open Side Panel** for the rich desktop control center, or click **Detect Data on This Page** for instant extraction.
4. Preview the detected fields, adjust rules if needed, and click **Start Scraping**.
5. Once completed, visit the **Export Center** to download your JSON, CSV, XLSX, or complete ZIP archive with downloaded images.
