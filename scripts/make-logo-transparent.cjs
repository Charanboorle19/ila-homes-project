const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const inputPath = path.join(__dirname, '..', 'public', 'ila-homes-logo.png');
  const backupPath = path.join(__dirname, '..', 'public', 'ila-homes-logo-original.png');
  const outputPath = path.join(__dirname, '..', 'public', 'ila-homes-logo.png');

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(inputPath, backupPath);
  }

  const { data, info } = await sharp(backupPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const srcOffset = i * channels;
    const destOffset = i * 4;

    const r = data[srcOffset];
    const g = data[srcOffset + 1];
    const b = data[srcOffset + 2];

    // Luminance / max brightness
    const maxVal = Math.max(r, g, b);

    // If it's near black (e.g. noise floor <= 12), make it completely transparent
    if (maxVal <= 12) {
      out[destOffset] = 255;
      out[destOffset + 1] = 255;
      out[destOffset + 2] = 255;
      out[destOffset + 3] = 0;
    } else {
      // Scale alpha cleanly from threshold 12 to 255
      const alpha = Math.min(255, Math.max(0, Math.round(((maxVal - 12) / (255 - 12)) * 255)));
      out[destOffset] = 255;
      out[destOffset + 1] = 255;
      out[destOffset + 2] = 255;
      out[destOffset + 3] = alpha;
    }
  }

  await sharp(out, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);

  console.log('Successfully created transparent logo at', outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
