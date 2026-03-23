/**
 * Build script for the Usage Tracker extension.
 * Bundles TypeScript + React to plain JS. Run: node build.js
 */

const esbuild = require("esbuild");
const path = require("path");

const isWatch = process.argv.includes("--watch");
const outDir = path.join(__dirname, ".");

/** IIFE for all outputs - no ESM, compatible with current manifest and HTML */
const configs = [
  {
    entryPoints: ["src/background/index.ts"],
    outfile: path.join(outDir, "background.js"),
    format: "iife",
    globalName: "UsageTrackerBackground",
    bundle: true,
    minify: true,
    sourcemap: false,
    define: { "process.env.NODE_ENV": '"production"' },
  },
  {
    entryPoints: ["src/content/index.ts"],
    outfile: path.join(outDir, "content.js"),
    format: "iife",
    globalName: "UsageTrackerContent",
    bundle: true,
    minify: true,
    sourcemap: false,
    define: { "process.env.NODE_ENV": '"production"' },
  },
  {
    entryPoints: ["src/dashboard/index.tsx"],
    outfile: path.join(outDir, "dashboard.js"),
    format: "iife",
    globalName: "UsageTrackerDashboard",
    bundle: true,
    minify: true,
    sourcemap: false,
    define: { "process.env.NODE_ENV": '"production"' },
  },
];

async function build() {
  for (const c of configs) {
    await esbuild.build(c);
    console.log(`Built ${path.basename(c.outfile)}`);
  }
}

async function watch() {
  const contexts = await Promise.all(configs.map((c) => esbuild.context(c)));
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("Watching for changes...");
}

async function main() {
  if (isWatch) {
    await watch();
  } else {
    await build();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
