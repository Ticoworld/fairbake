import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const source = resolve(root, "target/idl/fairbake.json");
const destination = resolve(here, "../src/idl/fairbake.json");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`FairBake IDL synchronized from ${source}`);
