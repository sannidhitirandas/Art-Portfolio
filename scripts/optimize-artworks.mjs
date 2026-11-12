
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const inputFolders = [
  "client/public/gallery artworks",
  "client/public/spinshutter artworks",
  "client/public/gradient carousel artworks",
  "client/public/depth ribbon artworks",
];

const outputFolder = "client/public/optimized-artworks-v2";

const supportedFormats = [".jpg", ".jpeg", ".png", ".tif", ".tiff"];

async function getImages(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      files.push(...await getImages(fullPath));
    } else if (supportedFormats.includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function optimize() {
  let totalOriginal = 0;
  let totalOptimized = 0;
  let processed = 0;
  let failed = 0;

  for (const folder of inputFolders) {
    try {
      const images = await getImages(folder);

      for (const image of images) {
        try {
          const relativePath = path.relative("client/public", image);
          const parsed = path.parse(relativePath);

          const outputPath = path.join(
            outputFolder,
            parsed.dir,
            `${parsed.name}.webp`
          );

          await fs.mkdir(path.dirname(outputPath), { recursive: true });

          const originalSize = (await fs.stat(image)).size;

          const result = await sharp(image)
            .rotate()
            .resize({
              width: 1800,
              height: 1800,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({
              quality: 82,
              alphaQuality: 90,
              effort: 6,
              smartSubsample: true,
            })
            .toFile(outputPath);

          totalOriginal += originalSize;
          totalOptimized += result.size;
          processed++;

          console.log(
            `${path.basename(image)}: ` +
            `${(originalSize / 1024).toFixed(0)} KB → ` +
            `${(result.size / 1024).toFixed(0)} KB`
          );
        } catch (error) {
          failed++;
          console.error(`Failed: ${image}`, error.message);
        }
      }
    } catch (error) {
      failed++;
      console.error(`Folder error: ${folder}`, error.message);
    }
  }

  console.log("\n========== RESULTS ==========");
  console.log(`Images processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Original: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Optimized: ${(totalOptimized / 1024 / 1024).toFixed(2)} MB`);

  if (totalOriginal > 0) {
    console.log(
      `Space saved: ${(
        (1 - totalOptimized / totalOriginal) * 100
      ).toFixed(1)}%`
    );
  }
}

optimize();
