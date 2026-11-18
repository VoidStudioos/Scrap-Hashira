const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Decode all HTML entities (named, decimal, hex)
function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&zwnj;/gi, '\u200c')
    .replace(/&zwj;/gi, '\u200d')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&diams;/gi, '♦')
    .replace(/&bull;/gi, '•')
    .replace(/&hellip;/gi, '…')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    });
}

// Convert HTML to clean readable multiline text without glued words
function cleanHtmlToText(rawHtml) {
  if (!rawHtml) return '';

  let html = rawHtml;

  // 1. Remove script, style, noscript, svg blocks entirely
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  html = html.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  html = html.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // 2. Convert explicit break tags to newline
  html = html.replace(/<br\s*\/?>/gi, '\n');

  // 3. Convert block level elements (opening or closing) to newline
  // Prevents adjacent sentences from fusing together (e.g. unclosed <p> or adjacent <h3><p>)
  html = html.replace(/<\/?(?:p|div|section|article|main|header|footer|h[1-6]|li|tr|th|td|blockquote|hr)\b[^>]*>/gi, '\n');

  // 4. Strip any remaining inline tags (span, strong, em, a, b, i) by replacing with space
  html = html.replace(/<[^>]+>/g, ' ');

  // 5. Decode all HTML entities
  html = decodeHtmlEntities(html);

  // 6. Normalize Persian/Arabic characters
  html = html
    .replace(/\u0643/g, '\u06a9')
    .replace(/[\u0649\u064a]/g, '\u06cc')
    .replace(/\u200c{2,}/g, '\u200c');

  // 7. Clean up spaces around newlines and collapse multiple blank lines
  const lines = html
    .split(/\r?\n/)
    .map(line => line.replace(/[ \t\u00a0\u200b]+/g, ' ').trim())
    .filter(line => line.length > 0);

  return lines.join('\n');
}

// Sanitize filename or folder name for Windows / Linux
function sanitizeName(name) {
  if (!name) return 'unknown';
  return name
    .replace(/[\\/:*?"<>|]/g, '') // remove illegal filesystem characters
    .replace(/[()\\[\]{}]/g, '') // remove brackets
    .replace(/\s+/g, '-')        // replace spaces with dashes
    .replace(/[-_]{2,}/g, '-')   // collapse multiple dashes
    .trim()
    .slice(0, 60);               // limit length
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(encodeURI(url), {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
          ...(options.headers || {})
        }
      });
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function crawlAndExtract() {
  console.log('================================================================');
  console.log('   HASHIRA SCRAPER - FOLDER-ORGANIZED CRAWLER & TEXT ENGINE     ');
  console.log('   Target: Negar Khodro (https://www.negarkhodro.com)           ');
  console.log('================================================================\n');

  const baseOutputDir = path.resolve(__dirname, '../outputs/negarkhodro');
  const productsDir = path.join(baseOutputDir, 'products');
  const dataDir = path.join(baseOutputDir, 'data');
  const progressFile = path.join(baseOutputDir, 'progress.json');

  fs.mkdirSync(productsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const knownIds = [
    1050, 1052, 1053, 1054, 1055, 1056, 1057, 1058, 1059, 1060,
    1061, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1071,
    1072, 1073, 1074, 1075, 1076, 1077, 1078, 1079, 1080, 1081,
    1082, 1083, 1084, 1085, 1086, 1087, 1088, 1090, 1091, 1092,
    1093, 1094, 1096, 1097, 1098, 1099, 1100, 1101, 1102, 1103,
    1104, 1105
  ];

  console.log(`Processing ${knownIds.length} candidate product IDs with clean text extraction...\n`);

  const results = [];
  const manifest = {
    crawlDate: new Date().toISOString(),
    totalDiscovered: knownIds.length,
    products: []
  };

  // 2. Continuous Crawl Loop
  for (let idx = 0; idx < knownIds.length; idx++) {
    const id = knownIds[idx];
    const productUrl = `https://www.negarkhodro.com/GetProduct/${id}`;

    // Look for existing folder to avoid re-downloading images if already cached
    let existingFolder = null;
    if (fs.existsSync(productsDir)) {
      const dirs = fs.readdirSync(productsDir);
      const match = dirs.find(d => d.includes(`_${id}_`));
      if (match) {
        existingFolder = path.join(productsDir, match);
      }
    }

    let html = '';
    const cachedHtmlPath = existingFolder ? path.join(existingFolder, 'page.html') : null;
    if (cachedHtmlPath && fs.existsSync(cachedHtmlPath)) {
      html = fs.readFileSync(cachedHtmlPath, 'utf8');
    } else {
      try {
        console.log(`[${idx + 1}/${knownIds.length}] Fetching Product #${id}: ${productUrl}`);
        const res = await fetchWithRetry(productUrl);
        if (res && res.ok) {
          html = await res.text();
        }
      } catch (err) {
        console.log(`   Fetch failed for #${id}:`, err.message);
      }
    }

    if (!html || html.length < 500) {
      console.log(`   [${idx + 1}/${knownIds.length}] Empty or unavailable #${id}.`);
      continue;
    }

    // Title extraction with clean HTML parsing
    let title = '';
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      title = cleanHtmlToText(h1Match[1]).replace(/\n+/g, ' ').trim();
    } else {
      const titleTag = html.match(/<title>([^<]+)<\/title>/i);
      if (titleTag) title = decodeHtmlEntities(titleTag[1].replace(/[-|].*$/, '').trim());
    }

    if (!title || title.includes('یافت نشد') || title.includes('404')) {
      console.log(`   [${idx + 1}/${knownIds.length}] Product #${id} page not found (404).`);
      continue;
    }

    console.log(`[${idx + 1}/${knownIds.length}] Processing Product #${id}: ${title}`);

    // Folder naming
    const cleanTitle = sanitizeName(title);
    const folderName = `${String(results.length + 1).padStart(2, '0')}_${id}_${cleanTitle}`;
    const productFolder = existingFolder || path.join(productsDir, folderName);
    fs.mkdirSync(productFolder, { recursive: true });

    // Save page snapshot if not present
    const pageHtmlPath = path.join(productFolder, 'page.html');
    if (!fs.existsSync(pageHtmlPath)) {
      fs.writeFileSync(pageHtmlPath, html, 'utf8');
    }

    // Extract clean rich specifications from tab pane
    let fullDescription = '';
    const tabMatch = html.match(/<div[^>]*class=['"][^'"]*tab-pane[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i);
    if (tabMatch && tabMatch[1]) {
      fullDescription = cleanHtmlToText(tabMatch[1]);
    }

    if (!fullDescription || fullDescription.length < 20) {
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch) fullDescription = decodeHtmlEntities(descMatch[1].trim());
    }

    // Extract structured key features from description
    const features = [];
    const lines = fullDescription.split('\n');
    for (const l of lines) {
      const trimmed = l.replace(/^[♦•\-*\s]+/, '').trim();
      if (trimmed.length > 5 && (l.includes('♦') || l.includes('•') || l.startsWith('-') || l.startsWith('*') || trimmed.startsWith('قابلیت') || trimmed.startsWith('امکان') || trimmed.startsWith('دارای') || trimmed.startsWith('پشتیبانی'))) {
        features.push(trimmed);
      }
    }

    // Image handling
    const candidateImages = [];
    const orgMatches = html.matchAll(/data_img_org=["']?([^"'\s>]+)/gi);
    for (const om of orgMatches) {
      let u = om[1];
      if (!u.startsWith('http')) u = 'https://www.negarkhodro.com' + (u.startsWith('/') ? '' : '/') + u;
      candidateImages.push(u);
    }
    const productImgMatches = html.matchAll(/<img[^>]+class=["'][^"']*imgProduct[^"']*["'][^>]+src=["']([^"']+)["']/gi);
    for (const pm of productImgMatches) {
      let u = pm[1].replace(/&amp;/g, '&');
      if (!u.startsWith('http')) u = 'https://www.negarkhodro.com' + (u.startsWith('/') ? '' : '/') + u;
      candidateImages.push(u);
    }
    const filePartMatches = html.matchAll(/(?:src|data-src)=["'](\/file_part\/[^"']+)["']/gi);
    for (const fm of filePartMatches) {
      let u = fm[1];
      if (!u.includes('Logo') && !u.includes('require_files') && !u.includes('enamad')) {
        candidateImages.push('https://www.negarkhodro.com' + u);
      }
    }
    const uniqueImgs = Array.from(new Set(candidateImages));

    const downloadedImagesList = [];
    let mainImagePath = '';
    let mainImageSizeKB = 0;

    // Check existing downloaded images or download missing ones
    for (let imgIdx = 0; imgIdx < uniqueImgs.length; imgIdx++) {
      const imgUrl = uniqueImgs[imgIdx];
      const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
      const isMain = imgIdx === 0;
      const fileName = isMain ? `main${ext}` : `gallery_${String(imgIdx).padStart(2, '0')}${ext}`;
      const filePath = path.join(productFolder, fileName);
      const relativeFilePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');

      let sizeKB = 0;
      if (fs.existsSync(filePath)) {
        sizeKB = Math.round(fs.statSync(filePath).size / 1024);
      } else {
        try {
          const imgRes = await fetchWithRetry(imgUrl);
          if (imgRes && imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            fs.writeFileSync(filePath, buf);
            sizeKB = Math.round(buf.length / 1024);
          }
        } catch {}
      }

      if (fs.existsSync(filePath)) {
        downloadedImagesList.push({
          fileName,
          url: imgUrl,
          sizeKB,
          isMain
        });

        if (isMain) {
          mainImagePath = relativeFilePath;
          mainImageSizeKB = sizeKB;
        }
      }
    }

    // Product metadata object
    const productRecord = {
      productId: id,
      'کد محصول': id,
      'عنوان محصول': title,
      'پوشه محصول': path.basename(productFolder),
      'مشخصات و قابلیت‌ها': fullDescription,
      'ویژگی‌های کلیدی': features.slice(0, 5).join(' | '),
      'آدرس صفحه (URL)': productUrl,
      'تصویر اصلی (فایل)': mainImagePath,
      'حجم تصویر اصلی (KB)': mainImageSizeKB,
      'تعداد کل تصاویر ذخیره شده': downloadedImagesList.length,
      'وضعیت استخراج': 'کامل و موفق'
    };

    results.push(productRecord);

    // Write info.json inside the dedicated folder
    fs.writeFileSync(path.join(productFolder, 'info.json'), JSON.stringify({
      id,
      title,
      url: productUrl,
      folder: path.basename(productFolder),
      specifications: fullDescription,
      features,
      images: downloadedImagesList,
      crawledAt: new Date().toISOString()
    }, null, 2), 'utf8');

    manifest.products.push({
      id,
      title,
      folder: path.basename(productFolder),
      mainImage: mainImagePath,
      imageCount: downloadedImagesList.length,
      url: productUrl
    });
  }

  // 3. Generate Master Excel, CSV, and JSON Exports
  console.log('\n[Phase 3] Generating Master Data Exports with clean formatted text...');

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(results.map(r => {
    const copy = { ...r };
    delete copy.productId;
    return copy;
  }));

  ws['!cols'] = [
    { wch: 10 },
    { wch: 45 },
    { wch: 40 },
    { wch: 60 },
    { wch: 50 },
    { wch: 45 },
    { wch: 40 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 }
  ];

  xlsx.utils.book_append_sheet(wb, ws, 'محصولات نگار خودرو');

  const xlsxDataPath = path.join(dataDir, 'negarkhodro_products.xlsx');
  xlsx.writeFile(wb, xlsxDataPath);
  const xlsxRootPath = path.resolve(__dirname, '../negarkhodro_products.xlsx');
  xlsx.writeFile(wb, xlsxRootPath);

  const csvContent = '\uFEFF' + xlsx.utils.sheet_to_csv(ws);
  const csvDataPath = path.join(dataDir, 'negarkhodro_products.csv');
  fs.writeFileSync(csvDataPath, csvContent, 'utf8');
  fs.writeFileSync(path.resolve(__dirname, '../negarkhodro_products.csv'), csvContent, 'utf8');

  const jsonDataPath = path.join(dataDir, 'negarkhodro_products.json');
  fs.writeFileSync(jsonDataPath, JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(path.resolve(__dirname, '../negarkhodro_products.json'), JSON.stringify(results, null, 2), 'utf8');

  fs.writeFileSync(path.join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(progressFile, JSON.stringify({ results }, null, 2), 'utf8');

  console.log('================================================================');
  console.log(`✅ CRAWL & CLEANUP COMPLETE! Extracted ${results.length} total products.`);
  console.log(`📁 Products Folder: ${productsDir}`);
  console.log(`📊 Master Excel:    ${xlsxDataPath}`);
  console.log(`📄 Master CSV:      ${csvDataPath}`);
  console.log(`📜 Master JSON:     ${jsonDataPath}`);
  console.log('================================================================\n');

  return results;
}

if (require.main === module) {
  crawlAndExtract();
}

module.exports = { crawlAndExtract, sanitizeName, cleanHtmlToText, decodeHtmlEntities };
