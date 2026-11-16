const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

function addDirectoryToZip(zip, localDir, zipPrefix = '') {
  if (!fs.existsSync(localDir)) return;
  const items = fs.readdirSync(localDir);
  for (const item of items) {
    const fullPath = path.join(localDir, item);
    const stat = fs.statSync(fullPath);
    const zipPath = zipPrefix ? `${zipPrefix}/${item}` : item;
    if (stat.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipPath);
    } else {
      zip.file(zipPath, fs.readFileSync(fullPath));
    }
  }
}

async function createBundle() {
  console.log('Packaging complete organized dataset into ZIP archive...');
  const zip = new JSZip();
  const rootDir = path.resolve(__dirname, '..');
  const outputsDir = path.join(rootDir, 'outputs', 'negarkhodro');

  if (fs.existsSync(outputsDir)) {
    // Add all organized products and data
    addDirectoryToZip(zip, outputsDir, 'negarkhodro');
  }

  // Also include root master tables
  const xlsxPath = path.join(rootDir, 'negarkhodro_products.xlsx');
  const csvPath = path.join(rootDir, 'negarkhodro_products.csv');
  const jsonPath = path.join(rootDir, 'negarkhodro_products.json');

  if (fs.existsSync(xlsxPath)) zip.file('negarkhodro_products.xlsx', fs.readFileSync(xlsxPath));
  if (fs.existsSync(csvPath)) zip.file('negarkhodro_products.csv', fs.readFileSync(csvPath));
  if (fs.existsSync(jsonPath)) zip.file('negarkhodro_products.json', fs.readFileSync(jsonPath));

  // Generate ZIP
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const outPath = path.join(rootDir, 'negarkhodro_complete_dataset.zip');
  fs.writeFileSync(outPath, content);
  console.log(`Archive created: ${outPath} (${(content.length / 1024).toFixed(1)} KB)`);
}

createBundle();
