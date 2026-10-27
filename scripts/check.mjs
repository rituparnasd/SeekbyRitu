import { readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const files = ["server.mjs"];
for (const directory of ["lib", "public", "scripts", "tests"])
  for (const name of await readdir(directory))
    if (/\.(mjs|js|cjs)$/.test(name)) files.push(directory + "/" + name);
for (const path of files)
  execFileSync(process.execPath, ["--check", path], { stdio: "inherit" });
console.log(`Syntax checks passed for ${files.length} JavaScript files.`);
