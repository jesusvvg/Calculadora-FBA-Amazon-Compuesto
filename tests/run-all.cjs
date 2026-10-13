"use strict";
const { spawnSync } = require("node:child_process");

const suites = [
  "tests/amazon-plan-expenses.cjs",
  "tests/calculadora-launcher.cjs",
  "tests/jev-observer.cjs",
  "tests/multiple-asins.cjs",
  "tests/operation-close.cjs"
];

for (const suite of suites) {
  process.stdout.write(`\n=== ${suite} ===\n`);
  const result = spawnSync(process.execPath, [suite], { stdio: "inherit" });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\nTodas las suites pasaron.");
