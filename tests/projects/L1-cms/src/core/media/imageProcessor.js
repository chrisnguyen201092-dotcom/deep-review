const sharp = require('sharp');
const path = require('path');

/**
 * Image processing utilities
 * Generates thumbnails and optimized versions
 */
async function generateThumbnail(inputPath, outputDir, sizes = [200, 400, 800]) {
  const results = [];
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `${basename}-${size}w${ext}`);
    await sharp(inputPath).resize(size).jpeg({ quality: 80 }).toFile(outputPath);
    results.push({ size, path: outputPath });
  }
  return results;
}

async function getImageMetadata(filePath) {
  const metadata = await sharp(filePath).metadata();
  return { width: metadata.width, height: metadata.height, format: metadata.format };
}

module.exports = { generateThumbnail, getImageMetadata };
