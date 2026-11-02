import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data: height rows, each row has 1 filter byte (0) + width * 4 bytes RGBA
  const rawRowLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * rawRowLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawRowLength;
    rawData[rowOffset] = 0; // Filter type None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Teal gradient: Teal-600 #0d9488 to Teal-800 #115e59
      // Border: dark teal
      const isBorder = (x < 1 || x >= width - 1 || y < 1 || y >= height - 1);
      const isH = (x >= width * 0.25 && x <= width * 0.35) ||
                  (x >= width * 0.65 && x <= width * 0.75) ||
                  (y >= height * 0.42 && y <= height * 0.58 && x >= width * 0.25 && x <= width * 0.75);

      if (isBorder && width > 16) {
        rawData[pxOffset] = 17;     // R
        rawData[pxOffset + 1] = 94;  // G
        rawData[pxOffset + 2] = 89;  // B
        rawData[pxOffset + 3] = 255; // A
      } else if (isH) {
        // Bright cyan / white for the "H"
        rawData[pxOffset] = 240;
        rawData[pxOffset + 1] = 253;
        rawData[pxOffset + 2] = 250;
        rawData[pxOffset + 3] = 255;
      } else {
        // Teal background
        const factor = y / height;
        rawData[pxOffset] = Math.round(13 + factor * (17 - 13));
        rawData[pxOffset + 1] = Math.round(148 - factor * (148 - 94));
        rawData[pxOffset + 2] = Math.round(136 - factor * (136 - 89));
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

// Standard CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return c ^ -1;
}

const outDir = path.resolve('public/icons');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'icon16.png'), createPng(16, 16));
fs.writeFileSync(path.join(outDir, 'icon48.png'), createPng(48, 48));
fs.writeFileSync(path.join(outDir, 'icon128.png'), createPng(128, 128));

console.log('Icons generated successfully.');
