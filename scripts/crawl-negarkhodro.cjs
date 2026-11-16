const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

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
  console.log('   HASHIRA SCRAPER - CONTINUOUS FOLDER-ORGANIZED CRAWLER        ');
  console.log('   Target: Negar Khodro (https://www.negarkhodro.com)           ');
  console.log('================================================================\n');

  const baseOutputDir = path.resolve(__dirname, '../outputs/negarkhodro');
  const productsDir = path.join(baseOutputDir, 'products');
  const dataDir = path.join(baseOutputDir, 'data');
  const progressFile = path.join(baseOutputDir, 'progress.json');

  fs.mkdirSync(productsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // 1. Discover all active product targets
  console.log('[Phase 1] Discovering all available products on Negar Khodro...');

  const knownIds = [
    1050, 1052, 1053, 1054, 1055, 1056, 1057, 1058, 1059, 1060,
    1061, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1071,
    1072, 1073, 1074, 1075, 1076, 1077, 1078, 1079, 1080, 1081,
    1082, 1083, 1084, 1085, 1086, 1087, 1088, 1090, 1091, 1092,
    1093, 1094, 1096, 1097, 1098, 1099, 1100, 1101, 1102, 1103,
    1104, 1105
  ];

  console.log(`Discovered ${knownIds.length} candidate product IDs to process.\n`);

  // Load progress if exists to support "ادامه بده" (resume without re-downloading)
  let processedIds = new Set();
  let existingResults = [];
  if (fs.existsSync(progressFile)) {
    try {
      const pData = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      if (Array.isArray(pData.results)) {
        existingResults = pData.results;
        pData.results.forEach(r => {
          if (r.productId) processedIds.add(r.productId);
        });
        console.log(`Resuming previous crawl: ${processedIds.size} products already processed.`);
      }
    } catch {}
  }

  const results = [...existingResults];
  const manifest = {
    crawlDate: new Date().toISOString(),
    totalDiscovered: knownIds.length,
    products: []
  };

  // 2. Continuous Crawl Loop
  for (let idx = 0; idx < knownIds.length; idx++) {
    const id = knownIds[idx];
    const productUrl = `https://www.negarkhodro.com/GetProduct/${id}`;

    // Skip if already processed in previous run
    if (processedIds.has(id)) {
      console.log(`[${idx + 1}/${knownIds.length}] Product #${id} already processed. Skipping.`);
      continue;
    }

    console.log(`\n[${idx + 1}/${knownIds.length}] Crawling Product #${id}: ${productUrl}`);

    try {
      const res = await fetchWithRetry(productUrl);
      if (!res.ok) {
        console.log(`   HTTP ${res.status} - Not accessible.`);
        continue;
      }

      const html = await res.text();
      if (!html || html.length < 500) {
        console.log('   Empty page response, skipping.');
        continue;
      }

      // Title extraction
      let title = '';
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        title = h1Match[1].trim();
      } else {
        const titleTag = html.match(/<title>([^<]+)<\/title>/i);
        if (titleTag) title = titleTag[1].replace(/[-|].*$/, '').trim();
      }
      if (!title || title.includes('یافت نشد') || title.includes('404')) {
        console.log('   Product page not found (404/Empty title).');
        continue;
      }

      console.log(`   Title: ${title}`);

      // Folder naming: e.g. "01_1053_دستگاه-عیب-یاب-OBD-Tools-2"
      const cleanTitle = sanitizeName(title);
      const folderName = `${String(results.length + 1).padStart(2, '0')}_${id}_${cleanTitle}`;
      const productFolder = path.join(productsDir, folderName);
      fs.mkdirSync(productFolder, { recursive: true });

      // Save raw HTML page snapshot (Full Capture)
      fs.writeFileSync(path.join(productFolder, 'page.html'), html, 'utf8');

      // Extract rich description / specifications from tab panes or panels
      let fullDescription = '';
      const tabMatch = html.match(/<div[^>]*class=['"][^'"]*tab-pane[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i);
      if (tabMatch && tabMatch[1]) {
        fullDescription = tabMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/&diams;/gi, '♦')
          .replace(/&nbsp;/gi, ' ')
          .replace(/<[^>]+>/g, '')
          .replace(/\n\s*\n+/g, '\n')
          .trim();
      }

      if (!fullDescription) {
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (descMatch) fullDescription = descMatch[1].trim();
      }

      // Extract key features
      const features = [];
      if (fullDescription.includes('♦')) {
        const parts = fullDescription.split('♦').map(s => s.trim()).filter(s => s.length > 5);
        features.push(...parts);
      }

      // Extract all high-resolution images
      const candidateImages = [];

      // Pattern 1: data_img_org (original full-res files)
      const orgMatches = html.matchAll(/data_img_org=["']?([^"'\s>]+)/gi);
      for (const om of orgMatches) {
        let u = om[1];
        if (!u.startsWith('http')) u = 'https://www.negarkhodro.com' + (u.startsWith('/') ? '' : '/') + u;
        candidateImages.push(u);
      }

      // Pattern 2: imgProduct
      const productImgMatches = html.matchAll(/<img[^>]+class=["'][^"']*imgProduct[^"']*["'][^>]+src=["']([^"']+)["']/gi);
      for (const pm of productImgMatches) {
        let u = pm[1].replace(/&amp;/g, '&');
        if (!u.startsWith('http')) u = 'https://www.negarkhodro.com' + (u.startsWith('/') ? '' : '/') + u;
        candidateImages.push(u);
      }

      // Pattern 3: file_part product images
      const filePartMatches = html.matchAll(/(?:src|data-src)=["'](\/file_part\/[^"']+)["']/gi);
      for (const fm of filePartMatches) {
        let u = fm[1];
        if (!u.includes('Logo') && !u.includes('require_files') && !u.includes('enamad')) {
          candidateImages.push('https://www.negarkhodro.com' + u);
        }
      }

      const uniqueImgs = Array.from(new Set(candidateImages));
      console.log(`   Found ${uniqueImgs.length} image candidate(s).`);

      const downloadedImagesList = [];
      let mainImagePath = '';
      let mainImageSizeKB = 0;

      // Download images into the product's dedicated folder
      for (let imgIdx = 0; imgIdx < uniqueImgs.length; imgIdx++) {
        const imgUrl = uniqueImgs[imgIdx];
        const isMain = imgIdx === 0;
        const ext = imgUrl.includes('.png') ? '.png' : '.jpg';
        const imgFileName = isMain ? `main${ext}` : `gallery_${String(imgIdx).padStart(2, '0')}${ext}`;
        const targetImgPath = path.join(productFolder, imgFileName);

        try {
          const imgRes = await fetchWithRetry(imgUrl, {
            headers: { 'Referer': 'https://www.negarkhodro.com/' }
          });
          if (imgRes && imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf.length > 500) {
              fs.writeFileSync(targetImgPath, buf);
              const sizeKB = Math.round(buf.length / 1024);
              downloadedImagesList.push({
                fileName: imgFileName,
                url: imgUrl,
                sizeKB,
                isMain
              });
              if (isMain) {
                mainImagePath = `outputs/negarkhodro/products/${folderName}/${imgFileName}`;
                mainImageSizeKB = sizeKB;
              }
              console.log(`   -> Downloaded [${imgFileName}]: ${sizeKB} KB`);
            }
          }
        } catch (e) {
          console.log(`   -> Failed to download image ${imgUrl}: ${e.message}`);
        }
      }

      // Save info.json inside product folder
      const productInfo = {
        id,
        title,
        url: productUrl,
        folder: folderName,
        specifications: fullDescription,
        features: features.slice(0, 5),
        images: downloadedImagesList,
        crawledAt: new Date().toISOString()
      };
      fs.writeFileSync(path.join(productFolder, 'info.json'), JSON.stringify(productInfo, null, 2), 'utf8');

      // Record for master Excel/CSV table
      const record = {
        productId: id,
        'کد محصول': id,
        'عنوان محصول': title,
        'پوشه محصول': folderName,
        'مشخصات و قابلیت‌ها': fullDescription,
        'ویژگی‌های کلیدی': features.slice(0, 4).join(' | '),
        'آدرس صفحه (URL)': productUrl,
        'تصویر اصلی (فایل)': mainImagePath || 'ناموجود',
        'حجم تصویر اصلی (KB)': mainImageSizeKB || '',
        'تعداد کل تصاویر ذخیره شده': downloadedImagesList.length,
        'وضعیت استخراج': 'کامل و موفق'
      };

      results.push(record);
      manifest.products.push(productInfo);

      // Save progressive state after each product
      fs.writeFileSync(progressFile, JSON.stringify({
        lastUpdated: new Date().toISOString(),
        totalProcessed: results.length,
        results
      }, null, 2), 'utf8');

      // Short delay between requests to be gentle
      await new Promise(r => setTimeout(r, 400));

    } catch (err) {
      console.log(`   Error processing product #${id}:`, err.message);
    }
  }

  // 3. Generate Master Excel, CSV, and JSON Exports
  console.log('\n[Phase 3] Generating Master Data Exports...');

  // Save Excel
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

  // Also write to root for backward compatibility
  const xlsxRootPath = path.resolve(__dirname, '../negarkhodro_products.xlsx');
  xlsx.writeFile(wb, xlsxRootPath);

  // Save CSV with UTF-8 BOM
  const csvContent = '\uFEFF' + xlsx.utils.sheet_to_csv(ws);
  const csvDataPath = path.join(dataDir, 'negarkhodro_products.csv');
  fs.writeFileSync(csvDataPath, csvContent, 'utf8');
  fs.writeFileSync(path.resolve(__dirname, '../negarkhodro_products.csv'), csvContent, 'utf8');

  // Save JSON
  const jsonDataPath = path.join(dataDir, 'negarkhodro_products.json');
  fs.writeFileSync(jsonDataPath, JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(path.resolve(__dirname, '../negarkhodro_products.json'), JSON.stringify(results, null, 2), 'utf8');

  // Save Manifest
  fs.writeFileSync(path.join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('================================================================');
  console.log(`✅ CRAWL COMPLETE! Extracted ${results.length} total products.`);
  console.log(`📁 Products Folder: ${productsDir}`);
  console.log(`📊 Master Excel:    ${xlsxDataPath}`);
  console.log(`📄 Master CSV:      ${csvDataPath}`);
  console.log(`📜 Master JSON:     ${jsonDataPath}`);
  console.log('================================================================\n');

  return results;
}

// Allow direct run
if (require.main === module) {
  crawlAndExtract();
}

module.exports = { crawlAndExtract, sanitizeName };
