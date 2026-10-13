// Lance une commande de développement écrite en TypeScript :
// `node scripts/run-dev-command.mjs <script> [arguments]`, appelé par les scripts
// `email:*` de package.json.
//
// esbuild assemble le script et le code de src/ qu'il importe en un seul fichier ;
// les paquets de node_modules restent EXTERNES et sont chargés par Node lui-même,
// comme en production. C'est ce qui évite les exécuteurs TypeScript « à la volée »
// (tsx…), qui résolvent mal les paquets réservés à `import` comme
// @react-pdf/hyphenate.
//
// `import "server-only"` lève une erreur hors d'un bundle serveur de Next. Une
// commande en ligne de commande est du code serveur : l'alias ci-dessous le
// remplace par un module vide.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { buildSync } from "esbuild";

const [script, ...args] = process.argv.slice(2);
if (script === undefined) {
  console.error("Usage : node scripts/run-dev-command.mjs <script> [arguments]");
  process.exit(1);
}

// Dans node_modules : ignoré par Git, et Node y retrouve les paquets externes.
const outDirectory = path.join("node_modules", ".cache", "quittances-scripts");
mkdirSync(outDirectory, { recursive: true });
const outFile = path.join(outDirectory, `${path.basename(script, ".mts")}.mjs`);

buildSync({
  entryPoints: [script],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  jsx: "automatic",
  alias: { "server-only": "./scripts/empty-module.mjs" },
  logLevel: "warning",
});

const result = spawnSync(process.execPath, [outFile, ...args], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
