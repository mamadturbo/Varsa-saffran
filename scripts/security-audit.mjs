import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
// Only these exact dev-only paths have been reviewed. New advisories, versions,
// production dependencies or changed paths fail closed.
const review = JSON.parse(
  readFileSync(
    new URL("../docs/security/dependency-exceptions.json", import.meta.url),
    "utf8",
  ),
);
if (Date.now() > Date.parse(review.reviewBefore))
  throw new Error("Dependency exception review expired");
const result =
  process.platform === "win32"
    ? spawnSync(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", "pnpm audit --json"],
        { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, windowsHide: true },
      )
    : spawnSync("pnpm", ["audit", "--json"], {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      });
let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  throw new Error("Dependency audit failed or did not return JSON");
}
if (audit.error || !audit.metadata || !audit.advisories)
  throw new Error("Dependency advisory service unavailable");
let rejected = 0,
  accepted = 0;
for (const advisory of Object.values(audit.advisories)) {
  const exception = review.exceptions.find(
    (e) =>
      e.id === advisory.github_advisory_id && e.module === advisory.module_name,
  );
  const allowed =
    exception &&
    advisory.findings.length > 0 &&
    advisory.findings.every(
      (f) =>
        f.dev === true &&
        f.version === exception.version &&
        f.paths.length > 0 &&
        f.paths.every((p) => exception.paths.includes(p)),
    );
  if (allowed) accepted++;
  else {
    rejected++;
    console.error(
      `Unreviewed advisory: ${advisory.github_advisory_id} (${advisory.module_name})`,
    );
  }
}
console.log(
  JSON.stringify({
    unreviewed: rejected,
    reviewedDevOnly: accepted,
    reviewBefore: review.reviewBefore,
  }),
);
if (rejected) process.exitCode = 1;
