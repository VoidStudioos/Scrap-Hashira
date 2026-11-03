const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function crawlAndExtract() {
  console.log('====================================================');
  console.log('   HASHIRA SCRAPER - DIRECT ENGINE EXTRACTION       ');
  console.log('   Target: Negar Khodro (https://www.negarkhodro.com)');
  console.log('====================================================\n');

  // Discover product URLs
  const targetUrls = [
    'https://www.negarkhodro.com',
    'https://www.negarkhodro.com/Products',
    'https://www.negarkhodro.com/Products/دستگاه-های-عیب-یاب'
  ];

  const productUrls = new Set();

  for (const tUrl of targetUrls) {
    try {
      console.log(`[Discovery] Fetching ${tUrl}...`);
      const res = await fetch(encodeURI(tUrl), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) continue;
      const html = await res.text();
      
      const linkRegex = /href=["'](\/(?:GetProduct|Product)\/[^"']+)["']/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const fullUrl = 'https://www.negarkhodro.com' + match[1];
        productUrls.add(fullUrl);
      }
    } catch (e) {
      console.log(`Error discovering from ${tUrl}:`, e.message);
    }
  }

  const knownUrls = [
    'https://www.negarkhodro.com/GetProduct/1053/دستگاه-عیب-یاب-(-دیاگ-)-نسل-دو-OBD-Tools-2',
    'https://www.negarkhodro.com/GetProduct/1054/دستگاه-پروگرامر-نسل-دو-ECUPROG-2',
    'https://www.negarkhodro.com/GetProduct/1055/دستگاه-عیب-یاب-نسل-یک-پلاس--OBD-Tools-1',
    'https://www.negarkhodro.com/GetProduct/1056/عیب-یابی-و-پروگرامینگ-موتورسیکلت',
    'https://www.negarkhodro.com/GetProduct/1098',
    'https://www.negarkhodro.com/GetProduct/1099',
    'https://www.negarkhodro.com/GetProduct/1100'
  ];
  knownUrls.forEach(u => productUrls.add(u));

  const list = Array.from(productUrls);
  console.log(`\nDiscovered ${list.length} unique product pages.\n`);

  const imageFolder = path.resolve(__dirname, '../extracted_images');
  if (!fs.existsSync(imageFolder)) {
    fs.mkdirSync(imageFolder, { recursive: true });
  }

  const results = [];

  for (let idx = 0; idx < list.length; idx++) {
    const pUrl = list[idx];
    console.log(`[Scraping ${idx + 1}/${list.length}] ${pUrl}`);
    try {
      const res = await fetch(encodeURI(pUrl), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) {
        console.log(`  Failed HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();

      // Extract Title
      let title = '';
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        title = h1Match[1].trim();
      } else {
        const titleTag = html.match(/<title>([^<]+)<\/title>/i);
        if (titleTag) title = titleTag[1].replace(/[-|].*$/, '').trim();
      }
      if (!title) title = `محصول #${idx + 1}`;

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

      // If no tab-pane, fallback to meta description or paragraphs
      if (!fullDescription) {
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (descMatch) fullDescription = descMatch[1].trim();
      }

      // Extract bullet points / features
      const features = [];
      if (fullDescription.includes('♦')) {
        const parts = fullDescription.split('♦').map(s => s.trim()).filter(s => s.length > 5);
        features.push(...parts);
      }

      // Extract images
      const candidateImages = [];

      // Check data_img_org (full resolution originals)
      const orgMatches = html.matchAll(/data_img_org=["']?([^"'\s>]+)/gi);
      for (const om of orgMatches) {
        let u = om[1];
        if (!u.startsWith('http')) u = 'https://www.negarkhodro.com' + (u.startsWith('/') ? '' : '/') + u;
        candidateImages.push(u);
      }

      // Check imgProduct
      const productImgMatches = html.matchAll(/<img[^>]+class=["'][^"']*imgProduct[^"']*["'][^>]+src=["']([^"']+)["']/gi);
      for (const pm of productImgMatches) {
        let u = pm[1].replace(/&amp;/g, '&');
        if (!u.startsWith('http')) u = 'https://www.negarkhodro.com' + (u.startsWith('/') ? '' : '/') + u;
        candidateImages.push(u);
      }

      // Check all file_part images
      const filePartMatches = html.matchAll(/(?:src|data-src)=["'](\/file_part\/[^"']+)["']/gi);
      for (const fm of filePartMatches) {
        let u = fm[1];
        if (!u.includes('Logo') && !u.includes('require_files') && !u.includes('enamad')) {
          candidateImages.push('https://www.negarkhodro.com' + u);
        }
      }

      const uniqueImgs = Array.from(new Set(candidateImages));
      const mainImageUrl = uniqueImgs[0] || '';

      // Download the primary image file
      let localDownloadedPath = '';
      let downloadedFileSizeKB = 0;

      if (mainImageUrl) {
        try {
          const imgRes = await fetch(encodeURI(mainImageUrl), {
            headers: {
              'Referer': 'https://www.negarkhodro.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf.length > 500) {
              const ext = mainImageUrl.includes('.png') ? '.png' : '.jpg';
              const cleanFileName = `product_${String(idx + 1).padStart(3, '0')}${ext}`;
              const filePath = path.join(imageFolder, cleanFileName);
              fs.writeFileSync(filePath, buf);
              localDownloadedPath = cleanFileName;
              downloadedFileSizeKB = Math.round(buf.length / 1024);
              console.log(`   -> Downloaded Image: ${cleanFileName} (${downloadedFileSizeKB} KB)`);
            }
          }
        } catch (e) {
          console.log(`   -> Image download failed:`, e.message);
        }
      }

      results.push({
        'کد محصول': idx + 1,
        'عنوان محصول': title,
        'مشخصات و قابلیت‌ها': fullDescription,
        'ویژگی‌های کلیدی': features.slice(0, 4).join(' | '),
        'آدرس صفحه (URL)': pUrl,
        'لینک تصویر اصلی': mainImageUrl,
        'فایل تصویر ذخیره شده': localDownloadedPath ? `extracted_images/${localDownloadedPath}` : 'ناموجود',
        'حجم فایل تصویر (KB)': downloadedFileSizeKB || '',
        'تعداد تصاویر شناسایی شده': uniqueImgs.length,
        'وضعیت پردازش': 'استخراج کامل و موفق'
      });

    } catch (err) {
      console.log(`  Error scraping ${pUrl}:`, err.message);
    }
  }

  // Save to Excel
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(results);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 45 },
    { wch: 60 },
    { wch: 50 },
    { wch: 45 },
    { wch: 45 },
    { wch: 25 },
    { wch: 18 },
    { wch: 22 },
    { wch: 20 }
  ];
  xlsx.utils.book_append_sheet(wb, ws, 'محصولات نگار خودرو');
  const xlsxPath = path.resolve(__dirname, '../negarkhodro_products.xlsx');
  xlsx.writeFile(wb, xlsxPath);

  // Save to CSV with UTF-8 BOM for Excel Persian compatibility
  const csvPath = path.resolve(__dirname, '../negarkhodro_products.csv');
  const csvContent = xlsx.utils.sheet_to_csv(ws);
  fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf8');

  // Save JSON
  const jsonPath = path.resolve(__dirname, '../negarkhodro_products.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');

  console.log('\n====================================================');
  console.log(` Extraction complete! Extracted ${results.length} products.`);
  console.log(` Excel: ${xlsxPath}`);
  console.log(` CSV:   ${csvPath}`);
  console.log(` JSON:  ${jsonPath}`);
  console.log(` Images: ${imageFolder}`);
  console.log('====================================================\n');
}

crawlAndExtract();
