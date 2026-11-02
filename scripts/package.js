import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

async function packageExtension() {
  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir)) {
    console.error('Dist directory does not exist! Please run npm run build first.');
    process.exit(1);
  }

  const zip = new JSZip();

  function addFolderToZip(folderPath, zipFolder) {
    const items = fs.readdirSync(folderPath);
    for (const item of items) {
      const fullPath = path.join(folderPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const subZip = zipFolder.folder(item);
        addFolderToZip(fullPath, subZip);
      } else {
        const fileData = fs.readFileSync(fullPath);
        zipFolder.file(item, fileData);
      }
    }
  }

  console.log('Packaging extension files into ZIP...');
  addFolderToZip(distDir, zip);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const outZipPath = path.resolve('hashira-scraper-v2.0.0.zip');
  fs.writeFileSync(outZipPath, zipBuffer);

  const stats = fs.statSync(outZipPath);
  console.log(`Package created successfully: ${outZipPath} (${Math.round(stats.size / 1024)} KB)`);
}

packageExtension().catch(console.error);
