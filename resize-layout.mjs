import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [inputPath, propertyId] = process.argv.slice(2);

if (!inputPath || !propertyId) {
  console.error('Usage: node resize-layout.mjs "<source-image-path>" <property-id>');
  process.exit(1);
}

if (!/^[a-zA-Z0-9_-]+$/.test(propertyId)) {
  console.error("Property ID may contain only letters, numbers, hyphens, and underscores.");
  process.exit(1);
}

const outputDirectory = resolve("public/layouts");
const outputPath = resolve(outputDirectory, `${propertyId}.webp`);

if (existsSync(outputPath)) {
  console.error(`Output already exists: ${outputPath}\nMove or rename it before running this script.`);
  process.exit(1);
}

mkdirSync(outputDirectory, { recursive: true });

await sharp(resolve(inputPath), { limitInputPixels: false })
  .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
  .webp({ quality: 85, alphaQuality: 90 })
  .toFile(outputPath);

console.log(`done: ${outputPath}`);
