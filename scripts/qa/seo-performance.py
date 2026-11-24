"""Measure a cold, throttled Chrome navigation. This script performs read-only visits."""

import argparse
import json
from statistics import median

from playwright.sync_api import sync_playwright


OBSERVERS = """
window.varsaLab = { lcp: null, cls: 0, largest: null };
new PerformanceObserver(list => {
  const entries = list.getEntries();
  const entry = entries.at(-1);
  if (entry) {
    window.varsaLab.lcp = entry.startTime;
    window.varsaLab.largest = entry.element?.tagName ?? null;
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });
let first, last, session = 0;
new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (entry.hadRecentInput) continue;
    if (first === undefined || entry.startTime - first > 5000 || entry.startTime - last > 1000) {
      session = 0;
      first = entry.startTime;
    }
    session += entry.value;
    last = entry.startTime;
    window.varsaLab.cls = Math.max(window.varsaLab.cls, session);
  }
}).observe({ type: 'layout-shift', buffered: true });
"""


def measure(browser, url):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        reduced_motion="reduce",
    )
    page = context.new_page()
    cdp = context.new_cdp_session(page)
    cdp.send("Network.enable")
    cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    cdp.send("Network.emulateNetworkConditions", {
        "offline": False, "latency": 150, "downloadThroughput": 204800, "uploadThroughput": 81920,
    })
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    page.add_init_script(OBSERVERS)
    response = page.goto(url, wait_until="domcontentloaded")
    assert response.status == 200, (url, response.status)
    page.wait_for_timeout(7000)
    result = page.evaluate(r"""() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const scripts = resources.filter(entry =>
        new URL(entry.name).origin === location.origin && new URL(entry.name).pathname.endsWith('.js'));
      return { ...window.varsaLab, ttfb: navigation.responseStart,
        html_bytes: navigation.encodedBodySize,
        js_bytes: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        js_files: scripts.length,
        public_data_requests: resources.filter(entry => /\/api\/(articles|store\/(content|products))$/.test(entry.name)).length,
        remote_font_requests: resources.filter(entry => /fonts\.googleapis|fonts\.gstatic/.test(entry.name)).length,
      };
    }""")
    context.close()
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()
    with sync_playwright() as playwright:
        with playwright.chromium.launch(channel="chrome", headless=True) as browser:
            rows = [measure(browser, args.url) for _ in range(args.runs)]
            fields = [key for key, value in rows[0].items() if isinstance(value, (int, float))]
            print(json.dumps({"url": args.url, "chrome": browser.version, "runs": rows,
                              "median": {key: median(row[key] for row in rows if row[key] is not None)
                                         for key in fields}}, indent=2))
