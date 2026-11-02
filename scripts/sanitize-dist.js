import fs from 'fs';
import path from 'path';

function sanitizeFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');

  // Replace any non-ASCII character (code point > 127) with standard \uXXXX escape sequence
  const asciiContent = content.replace(/[\u0080-\uFFFF]/g, (ch) => {
    return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
  });

  // Write back strictly as UTF-8 without BOM
  fs.writeFileSync(filePath, asciiContent, { encoding: 'utf8' });

  // Verification
  const buf = fs.readFileSync(filePath);
  let hasNonAscii = false;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] > 127) {
      hasNonAscii = true;
      break;
    }
  }

  console.log(`[Sanitizer] ${path.basename(filePath)} processed. Pure ASCII/UTF-8 verified: ${!hasNonAscii}. File size: ${buf.length} bytes.`);
}

const distDir = path.resolve('dist');
const filesToSanitize = ['content.js', 'background.js'];

for (const file of filesToSanitize) {
  const fullPath = path.join(distDir, file);
  sanitizeFile(fullPath);
}
