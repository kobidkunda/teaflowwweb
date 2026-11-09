import { chromium } from "@playwright/test";

const routes = [
  "/",
  "/shop",
  "/tea/darjeeling-spring",
  "/cart",
  "/checkout",
  "/leaf-to-cup",
  "/blog",
  "/blog/darjeeling-first-flush-guide",
  "/contact",
  "/about",
  "/tea-finder",
  "/wholesale",
];

const widths = [320, 360, 375, 390, 414, 430];
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

async function run() {
  const browser = await chromium.launch({
    args: ["--no-proxy-server", "--disable-gpu"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Block third-party scripts/trackers that delay domcontentloaded
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (
      url.includes("google-analytics") ||
      url.includes("googletagmanager") ||
      url.includes("connect.facebook.net") ||
      url.includes("doubleclick")
    ) {
      return route.abort();
    }
    return route.continue();
  });

  console.log(`Starting Mobile Overflow Audit against ${baseUrl}...`);
  const report = [];

  for (const route of routes) {
    try {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(300);
    } catch (e) {
      console.error(`Failed to load ${route}: ${e.message}`);
      continue;
    }

    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(100);

      // Check document overflow
      const overflowData = await page.evaluate(() => {
        const docElem = document.documentElement;
        const body = document.body;
        const scrollW = Math.max(docElem.scrollWidth, body.scrollWidth);
        const innerW = window.innerWidth;
        const diff = scrollW - innerW;

        const overflowingElements = [];
        if (diff > 0.5) {
          const all = document.querySelectorAll("*");
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              style.opacity === "0"
            ) {
              continue;
            }
            // Check if element extends beyond the right edge of the viewport
            if (rect.right > innerW + 0.5) {
              overflowingElements.push({
                tag: el.tagName.toLowerCase(),
                className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
                id: el.id || "",
                text: (el.textContent || "").trim().slice(0, 40),
                rect: {
                  left: Math.round(rect.left),
                  right: Math.round(rect.right),
                  width: Math.round(rect.width),
                },
                computedWidth: style.width,
                computedMaxWidth: style.maxWidth,
                overflow: style.overflow,
              });
            }
          }
        }

        return {
          scrollW,
          innerW,
          diff,
          overflowingCount: overflowingElements.length,
          topOverflowing: overflowingElements.slice(0, 8),
        };
      });

      if (overflowData.diff > 0.5) {
        console.log(
          `❌ OVERFLOW: ${route} @ ${width}px: scrollWidth=${overflowData.scrollW} (diff: +${overflowData.diff}px)`
        );
        report.push({
          route,
          width,
          diff: overflowData.diff,
          elements: overflowData.topOverflowing,
        });
      } else {
        console.log(`✅ OK: ${route} @ ${width}px (scrollWidth=${overflowData.scrollW}, innerWidth=${overflowData.innerW})`);
      }
    }
  }

  // Also test drawer/overlay interactions
  console.log("\nTesting mobile drawer & interactive elements...");
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    // Home drawer
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 10000 });
    const menuBtn = page.locator(".mobile-menu, .ritual-menu, button[aria-label*='menu' i]").first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(300);
      const navOverflow = await page.evaluate(() => {
        return {
          scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          innerW: window.innerWidth,
        };
      });
      if (navOverflow.scrollW > navOverflow.innerW + 0.5) {
        console.log(`❌ OVERFLOW on Home menu open @ ${width}px: +${navOverflow.scrollW - navOverflow.innerW}px`);
      } else {
        console.log(`✅ OK on Home menu open @ ${width}px`);
      }
    }

    // Shop drawer/filter
    await page.goto(`${baseUrl}/shop`, { waitUntil: "domcontentloaded", timeout: 10000 });
    const filterBtn = page.locator(".shop-mobile-drawer-btn, button:has-text('Filters')").first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);
      const filterOverflow = await page.evaluate(() => {
        return {
          scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          innerW: window.innerWidth,
        };
      });
      if (filterOverflow.scrollW > filterOverflow.innerW + 0.5) {
        console.log(`❌ OVERFLOW on Shop filters open @ ${width}px: +${filterOverflow.scrollW - filterOverflow.innerW}px`);
      } else {
        console.log(`✅ OK on Shop filters open @ ${width}px`);
      }
    }
  }

  await browser.close();

  console.log("\n--- Audit Summary ---");
  console.log(`Total overflow issues: ${report.length}`);
  if (report.length > 0) {
    console.log(JSON.stringify(report, null, 2));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
