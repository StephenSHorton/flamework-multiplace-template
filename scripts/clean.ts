import { rmSync } from "node:fs";

const target = process.argv[2];
if (!target) {
	console.error("Usage: bun scripts/clean.ts <path>");
	process.exit(1);
}

rmSync(target, { recursive: true, force: true });
