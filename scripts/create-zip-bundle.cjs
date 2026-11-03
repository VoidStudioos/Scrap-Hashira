const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createBundle() {
  console.log('Packaging complete dataset into ZIP archive...');
  const zip = new JSZip();

  // Add Excel, CSV, JSON
  const rootDir = path.resolve(__dirname, '..');
  const xlsxPath = path.join(rootDir, 'negarkhodro_products.xlsx');
  const csvPath = path.join(rootDir, 'negarkhodro_products.csv');
  const jsonPath = path.join(rootDir, 'negarkhodro_products.json');

  if (fs.existsSync(xlsxPath)) {
    zip.file('negarkhodro_products.xlsx', fs.readFileSync(xlsxPath));
  }
  if (fs.existsSync(csvPath)) {
    zip.file('negarkhodro_products.csv', fs.readFileSync(csvPath));
  }
  if (fs.existsSync(jsonPath)) {
    zip.file('negarkhodro_products.json', fs.readFileSync(jsonPath));
  }

  // Add all images to images/ folder inside zip
  const imgFolder = path.join(rootDir, 'extracted_images');
  if (fs.existsSync(imgFolder)) {
    const imgZipFolder = zip.folder('images');
    const files = fs.readdirSync(imgFolder);
    for (const f of files) {
      const fPath = path.join(imgFolder, f);
      if (fs.statSync(fPath).isFile()) {
        imgZipFolder.file(f, fs.readFileSync(fPath));
      }
    }
  }

  // Generate ZIP
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const outPath = path.join(rootDir, 'negarkhodro_complete_dataset.zip');
  fs.writeFileSync(outPath, content);
  console.log(`Archive created: ${outPath} (${(content.length / 1024).toFixed(1)} KB)`);
}

createBundle();
