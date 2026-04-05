// One-off helper that loads the live site in a headless browser, clicks
// through a handful of states and saves a PNG for each. Not wired into the
// build pipeline — run `node scripts/takeScreenshots.mjs` when the README
// screenshots need a refresh. Requires `npx playwright install chromium`.

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
const URL = 'https://aykutsp.github.io/world-fuel-prices/';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  console.log('Loading live site...');
  await page.goto(URL, { waitUntil: 'networkidle' });
  // Leaflet needs a moment for tiles + choropleth.
  await page.waitForTimeout(3000);

  // 1) Explore — default "All Fuels" view
  console.log('  [1/4] explore-all-fuels');
  await page.screenshot({ path: path.join(OUT, 'explore-all-fuels.png'), fullPage: false });

  // 2) Explore — Gasoline only
  console.log('  [2/4] explore-gasoline');
  await page.getByRole('button', { name: /^gasoline$/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'explore-gasoline.png'), fullPage: false });

  // 3) Trip — Istanbul → Berlin preset
  console.log('  [3/4] trip-istanbul-berlin');
  await page.getByRole('button', { name: 'Trip' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /istanbul.*berlin/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Calculate$/i }).click();
  // Geocoding + routing + country resolution = a few seconds.
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(OUT, 'trip-istanbul-berlin.png'), fullPage: false });

  // 4) Trip — Paris → Munich, a smaller fill example
  console.log('  [4/4] trip-paris-munich');
  // Reset and pick the other preset.
  const resetBtn = page.locator('.trip-reset-btn');
  if (await resetBtn.count()) {
    await resetBtn.first().click();
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: /paris.*munich/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Calculate$/i }).click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(OUT, 'trip-paris-munich.png'), fullPage: false });

  await browser.close();
  console.log(`\n✓ wrote 4 screenshots to ${OUT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
