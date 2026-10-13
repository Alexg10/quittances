// Commande de développement : envoie une quittance par e-mail, comme le fera
// l'écran d'envoi, sans interface. `pnpm email:send <identifiant-de-quittance>`.
//
// Refuse de tourner si le transport n'est pas le transport local : cette
// commande ne doit jamais envoyer un vrai message. Elle écrit dans la base de
// DATABASE_URL (développement), le message est rangé dans `local_email`.
// Elle n'affiche que le nom du résultat.
//
// Lancée avec scripts/run-dev-command.mjs (voir package.json) : sans lui,
// l'import "server-only" des modules ci-dessous lève une erreur.
import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db";
import { receipt, user } from "../src/db/schema";
import { loadLocalEnv } from "../src/env";
import { sendReceipt } from "../src/receipts/receipt-sending";

async function main(): Promise<number> {
  loadLocalEnv();
  const receiptId = process.argv[2];
  if (receiptId === undefined) {
    console.error("Usage : pnpm email:send <identifiant-de-quittance>");
    return 1;
  }
  if (process.env.EMAIL_TRANSPORT !== "local") {
    console.error("Refusé : EMAIL_TRANSPORT doit valoir « local ».");
    return 1;
  }

  // Le compte qui possède la quittance. Cette lecture par identifiant seul est
  // propre à cette commande de développement : l'application, elle, ne lit
  // jamais une quittance sans son propriétaire.
  const rows = await getDb()
    .select({ id: user.id, email: user.email })
    .from(receipt)
    .innerJoin(user, eq(user.id, receipt.ownerId))
    .where(eq(receipt.id, receiptId));
  const owner = rows[0];
  if (owner === undefined) {
    console.error("Quittance introuvable.");
    return 1;
  }

  const result = await sendReceipt(owner, receiptId, new Date());
  console.log(`Résultat : ${result}`);
  return result === "envoyée" ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // Le nom de l'erreur seulement : son message pourrait contenir des données.
    console.error("Échec inattendu :", error instanceof Error ? error.name : typeof error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
