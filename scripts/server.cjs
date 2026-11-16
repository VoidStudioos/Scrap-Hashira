const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 4000;
const ROOT_DIR = path.resolve(__dirname, '..');

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  // Serve static files / API
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderDashboardHtml());
    return;
  }

  // API: Get current dataset
  if (pathname === '/api/data') {
    const jsonPath = path.join(ROOT_DIR, 'negarkhodro_products.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, count: data.length, data }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: 0, data: [] }));
    }
    return;
  }

  // API: Trigger scrape / continue crawl
  if (pathname === '/api/scrape' && req.method === 'POST') {
    console.log('[Runner] Continuous folder-organized scraping triggered...');
    try {
      const { execSync } = require('child_process');
      const output = execSync('node scripts/crawl-negarkhodro.cjs', { cwd: ROOT_DIR }).toString();
      execSync('node scripts/create-zip-bundle.cjs', { cwd: ROOT_DIR });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'استخراج و فولدر‌بندی با موفقیت انجام شد', log: output }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // Download Excel
  if (pathname === '/download/excel') {
    const p = path.join(ROOT_DIR, 'negarkhodro_products.xlsx');
    if (fs.existsSync(p)) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="negarkhodro_products.xlsx"'
      });
      fs.createReadStream(p).pipe(res);
      return;
    }
  }

  // Download CSV
  if (pathname === '/download/csv') {
    const p = path.join(ROOT_DIR, 'negarkhodro_products.csv');
    if (fs.existsSync(p)) {
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="negarkhodro_products.csv"'
      });
      fs.createReadStream(p).pipe(res);
      return;
    }
  }

  // Download JSON
  if (pathname === '/download/json') {
    const p = path.join(ROOT_DIR, 'negarkhodro_products.json');
    if (fs.existsSync(p)) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="negarkhodro_products.json"'
      });
      fs.createReadStream(p).pipe(res);
      return;
    }
  }

  // Download ZIP
  if (pathname === '/download/zip') {
    const p = path.join(ROOT_DIR, 'negarkhodro_complete_dataset.zip');
    if (fs.existsSync(p)) {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="negarkhodro_complete_dataset.zip"'
      });
      fs.createReadStream(p).pipe(res);
      return;
    }
  }

  // Serve files from outputs folder
  if (pathname.startsWith('/outputs/')) {
    const safePath = path.normalize(path.join(ROOT_DIR, pathname));
    if (safePath.startsWith(path.join(ROOT_DIR, 'outputs')) && fs.existsSync(safePath)) {
      const ext = path.extname(safePath).toLowerCase();
      let mime = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.html') mime = 'text/html; charset=utf-8';
      else if (ext === '.json') mime = 'application/json; charset=utf-8';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(safePath).pipe(res);
      return;
    }
  }

  // Serve image files from extracted_images (legacy support)
  if (pathname.startsWith('/extracted_images/')) {
    const imgName = path.basename(pathname);
    const imgPath = path.join(ROOT_DIR, 'extracted_images', imgName);
    if (fs.existsSync(imgPath)) {
      const ext = path.extname(imgPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(imgPath).pipe(res);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('یافت نشد (404 Not Found)');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Hashira Scraper Web Runner is live!`);
  console.log(`👉 Open in your browser: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});

function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>داشبورد استخراج هوشمند و فولدر‌بندی شده هاشیرو (Hashira Scraper)</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f2937;
      --primary: #06b6d4;
      --primary-hover: #0891b2;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, Segoe UI, Tahoma, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px; direction: rtl; }
    .container { max-width: 1300px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .logo-box { display: flex; align-items: center; gap: 12px; }
    .logo-badge { background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; font-weight: 800; font-size: 20px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #fff; }
    .subtitle { font-size: 13px; color: var(--text-muted); }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .stat-title { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
    .stat-val { font-size: 26px; font-weight: 800; color: var(--primary); }
    .actions-bar { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: 0.2s; }
    .btn-primary { background: var(--primary); color: #000; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn-outline:hover { background: rgba(255,255,255,0.05); border-color: var(--primary); }
    .btn-success { background: #059669; color: #fff; }
    .btn-success:hover { background: #047857; }
    .table-container { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; text-align: right; font-size: 13px; }
    th { background: #1f2937; padding: 12px 16px; font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: top; }
    tr:hover { background: rgba(255,255,255,0.02); }
    .thumb { width: 70px; height: 70px; object-fit: contain; background: #fff; border-radius: 6px; padding: 2px; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 11px; background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .folder-badge { display: inline-block; padding: 2px 6px; border-radius: 6px; font-size: 11px; background: #1e293b; color: #38bdf8; font-family: monospace; }
    .product-title { font-weight: 600; color: #fff; margin-bottom: 4px; }
    .product-desc { font-size: 11px; color: var(--text-muted); line-height: 1.5; max-height: 80px; overflow-y: auto; }
    #logOutput { background: #000; color: #10b981; font-family: monospace; font-size: 12px; padding: 12px; border-radius: 8px; margin-top: 12px; display: none; direction: ltr; text-align: left; max-height: 200px; overflow-y: auto; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-box">
        <div class="logo-badge">H</div>
        <div>
          <h1>استخراج پیوسته و فولدر‌بندی خودکار Hashira Scraper</h1>
          <div class="subtitle">دسته‌بندی خودکار هر محصول در پوشه مجزا، نام‌گذاری منظم، ذخیره تصاویر اصلی و گالری، و کراول پیوسته</div>
        </div>
      </div>
      <div>
        <span class="badge">سیستم آماده • پورت ۴۰۰۰</span>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-title">محصولات استخراج شده</div>
        <div class="stat-val" id="productCount">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">پوشه‌های مجزا ساخته شده</div>
        <div class="stat-val" id="folderCount">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">سایت هدف</div>
        <div class="stat-val" style="font-size: 15px; margin-top: 6px; color: #e5e7eb;">نگار خودرو (negarkhodro.com)</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">ساختار ذخیره‌سازی</div>
        <div class="stat-val" style="font-size: 15px; margin-top: 6px; color: var(--primary);">outputs/negarkhodro/</div>
      </div>
    </div>

    <div class="actions-bar">
      <button class="btn btn-primary" onclick="runScrape()" id="scrapeBtn">
        🚀 اجرای کراول پیوسته و فولدر‌بندی کامل
      </button>
      <a href="/download/excel" class="btn btn-success">
        📊 دانلود فایل اکسل (Excel .xlsx)
      </a>
      <a href="/download/zip" class="btn btn-outline">
        📦 دانلود کل پکیج فولدر‌بندی شده (ZIP)
      </a>
      <a href="/download/csv" class="btn btn-outline">
        📄 دانلود CSV
      </a>
      <a href="/download/json" class="btn btn-outline">
        📜 دانلود JSON
      </a>
    </div>

    <pre id="logOutput"></pre>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th style="width: 90px;">تصویر</th>
            <th style="width: 250px;">عنوان و لینک</th>
            <th style="width: 220px;">پوشه اختصاصی محصول</th>
            <th>مشخصات و قابلیت‌ها</th>
            <th style="width: 100px;">حجم تصویر</th>
          </tr>
        </thead>
        <tbody id="dataTable">
          <tr><td colspan="6" style="text-align: center; padding: 24px;">در حال بارگذاری داده‌ها...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    async function loadData() {
      try {
        const res = await fetch('/api/data');
        const json = await res.json();
        if (json.success && json.data) {
          document.getElementById('productCount').textContent = json.count;
          document.getElementById('folderCount').textContent = json.count;
          const tbody = document.getElementById('dataTable');
          tbody.innerHTML = '';
          json.data.forEach((p, idx) => {
            const tr = document.createElement('tr');
            const rawImg = p['تصویر اصلی (فایل)'] || p['فایل تصویر ذخیره شده'] || '';
            const imgSrc = rawImg.startsWith('http') ? rawImg : '/' + rawImg;
            const folder = p['پوشه محصول'] || ('product_' + String(idx + 1).padStart(2, '0'));

            tr.innerHTML = \`
              <td>\${idx + 1}</td>
              <td>
                <img src="\${imgSrc}" class="thumb" onerror="this.src='https://via.placeholder.com/80?text=No+Img'">
              </td>
              <td>
                <div class="product-title">\${p['عنوان محصول']}</div>
                <a href="\${p['آدرس صفحه (URL)']}" target="_blank" style="color: #38bdf8; font-size: 11px; text-decoration: none;">مشاهده صفحه اصلی &larr;</a>
              </td>
              <td>
                <span class="folder-badge">📁 \${folder}</span>
              </td>
              <td>
                <div class="product-desc">\${p['مشخصات و قابلیت‌ها'] || 'اطلاعات در فایل info.json ذخیره شده است.'}</div>
              </td>
              <td>\${p['حجم تصویر اصلی (KB)'] || p['حجم فایل تصویر (KB)'] ? (p['حجم تصویر اصلی (KB)'] || p['حجم فایل تصویر (KB)']) + ' KB' : '-'}</td>
            \`;
            tbody.appendChild(tr);
          });
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function runScrape() {
      const btn = document.getElementById('scrapeBtn');
      const log = document.getElementById('logOutput');
      btn.disabled = true;
      btn.textContent = 'در حال کراول پیوسته و فولدر‌بندی...';
      log.style.display = 'block';
      log.textContent = 'در حال آغاز کراول تمام محصولات و تفکیک پوشه‌ها...';
      try {
        const res = await fetch('/api/scrape', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          log.textContent = data.log || 'عملیات با موفقیت انجام شد.';
          await loadData();
        } else {
          log.textContent = 'خطا: ' + data.error;
        }
      } catch (err) {
        log.textContent = 'خطای ارتباط: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 اجرای کراول پیوسته و فولدر‌بندی کامل';
      }
    }

    loadData();
  </script>
</body>
</html>
`;
}
