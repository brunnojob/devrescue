// Compile only the offline analyzer; do not bundle the web app or server modules.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, "bin"), { recursive: true });
const source = fs.readFileSync(path.join(root, "src/lib/analyzer.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
fs.writeFileSync(path.join(root, "bin/analyzer.cjs"), output);
