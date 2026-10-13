// Commande de développement : écrit chaque message du transport local en fichier
// .eml dans `.emails/` (ignoré par Git), pour l'ouvrir dans un client de
// messagerie. `pnpm email:export`. Lit la base de DATABASE_URL. Un fichier par
// message, nommé d'après sa date et son identifiant ; les fichiers existants
// sont réécrits. N'affiche que le nombre de fichiers.
//
// Lancée avec scripts/run-dev-command.mjs (voir package.json).
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { asc } from "drizzle-orm";

import { closeDb, getDb } from "../src/db";
import { localEmail } from "../src/db/schema";
import { buildEml } from "../src/email/eml";
import { loadLocalEnv } from "../src/env";

const OUTPUT_DIRECTORY = path.join(process.cwd(), ".emails");

async function main(): Promise<void> {
  loadLocalEnv();
  const rows = await getDb()
    .select()
    .from(localEmail)
    .orderBy(asc(localEmail.createdAt));
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  for (const row of rows) {
    const eml = buildEml(
      {
        to: row.recipient,
        from: { address: row.senderAddress, name: row.senderName },
        replyTo: { address: row.replyToAddress, name: row.replyToName },
        subject: row.subject,
        html: row.htmlBody,
        text: row.textBody,
        attachments: [
          {
            fileName: row.attachmentFileName,
            contentType: row.attachmentContentType,
            content: row.attachmentContent,
          },
        ],
      },
      { date: row.createdAt, boundary: `quittances-${randomUUID()}` },
    );
    const stamp = row.createdAt.toISOString().replace(/[-:.]/g, "");
    const fileName = `${stamp}-${row.id.slice(0, 8)}.eml`;
    await writeFile(path.join(OUTPUT_DIRECTORY, fileName), eml);
  }
  console.log(`${rows.length} fichier(s) .eml écrit(s) dans .emails/`);
}

main()
  .catch((error: unknown) => {
    console.error("Échec inattendu :", error instanceof Error ? error.name : typeof error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
