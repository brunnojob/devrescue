import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
await mkdir("api-dist", { recursive: true });
await build({
  entryPoints: ["api/server.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "api-dist/server.js",
  external: ["pg"],
  packages: "bundle",
});
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  "api-dist/package.json",
  JSON.stringify(
    {
      name: "devrescue-api",
      version: "1.0.0",
      private: true,
      type: "module",
      engines: { node: ">=22" },
      scripts: { start: "node server.js" },
      dependencies: { pg: pkg.dependencies.pg },
    },
    null,
    2,
  ),
);
