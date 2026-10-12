// Téléchargement d'une quittance en PDF : GET /quittances/<q>/pdf (R31 à R33 de
// la spécification 04). C'est un Route Handler : un fichier `route.ts` répond
// directement à une requête HTTP avec une `Response`, sans page ni layout.
// Il convient à une ressource (un fichier) ; une page, elle, rend du HTML.
//
// C'est un point d'entrée HTTP public, comme une Server Action. Il contrôle
// donc tout lui-même, dans cet ordre (R33) :
//
//   1. la session, avant de regarder l'identifiant ;
//   2. la quittance, lue pour ce propriétaire et lui seul ;
//   3. la construction du fichier, à partir des seules valeurs figées.
//
// Le proxy (src/proxy.ts) laisse passer cette adresse sans rediriger : la
// redirection d'un visiteur sans session part d'ici, sans paramètre `retour`.
// Un `retour` écrit à la main vers cette adresse est refusé lui aussi : voir
// NON_PAGE_PATH_PATTERNS dans src/auth/return-path.ts.
//
// Rendu : la fonction lit la session, donc les en-têtes de la requête, et son
// adresse a un segment dynamique. Next l'exécute à chaque requête (symbole `ƒ`
// de `pnpm build`) et ne met jamais sa réponse en cache.
import { unstable_rethrow } from "next/navigation";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import { getReceiptFileName } from "@/receipts/receipt-reference";
import {
  getReceipt,
  ReceiptStoreError,
  type Receipt,
} from "@/receipts/receipt-store";
import { renderReceiptPdf } from "@/receipts/render-receipt-pdf";

import {
  methodNotAllowedResponse,
  notFoundResponse,
  pdfResponse,
  signInRedirectResponse,
  unavailableResponse,
} from "./download-responses";

export async function GET(
  _request: Request,
  context: RouteContext<"/quittances/[id]/pdf">,
): Promise<Response> {
  // 1. La session. Le propriétaire vient d'elle et de rien d'autre (R21).
  let owner: Owner | null;
  try {
    owner = await getCurrentOwner();
  } catch (error) {
    // Next signale certaines situations par des erreurs internes : on les lui
    // rend.
    unstable_rethrow(error);
    // Seul le type de l'erreur est journalisé (R37).
    console.error(
      "Téléchargement de quittance : session non vérifiable",
      error instanceof Error ? error.name : typeof error,
    );
    return unavailableResponse(503);
  }
  if (owner === null) {
    // Même réponse que l'identifiant existe ou non : rien n'a été lu.
    return signInRedirectResponse();
  }

  // 2. La quittance. `id` vient de l'adresse, donc du visiteur : getReceipt
  // refuse toute forme non canonique sans lecture en base, et filtre sur le
  // propriétaire dans sa seule requête. « Pas à moi » et « n'existe pas »
  // rendent tous deux null (R22).
  const { id } = await context.params;
  let receipt: Receipt | null;
  try {
    receipt = await getReceipt(owner, id);
  } catch (error) {
    // Un Route Handler n'a pas de error.tsx au-dessus de lui : une erreur qui
    // remonterait donnerait une réponse 500 vide, et Next l'écrirait en entier
    // dans le journal. Toute erreur est donc traduite ici en réponse.
    console.error(
      "Téléchargement de quittance : lecture impossible",
      error instanceof Error ? error.name : typeof error,
    );
    // ReceiptStoreError : la base n'a pas répondu (503). Autre : erreur non
    // prévue (500).
    return unavailableResponse(error instanceof ReceiptStoreError ? 503 : 500);
  }
  if (receipt === null) {
    return notFoundResponse();
  }

  // 3. Le fichier, reconstruit à chaque téléchargement à partir des valeurs
  // figées de la quittance : ni la location ni les informations du bailleur ne
  // sont relues (R31). La date de création du fichier est l'instant de
  // production enregistré, jamais l'heure du téléchargement.
  // `await` : le fichier est construit en entier avant de répondre. En cas
  // d'échec, la réponse est une erreur 500, jamais un PDF incomplet.
  try {
    const pdf = await renderReceiptPdf(receipt, receipt.producedAt);
    return pdfResponse(pdf, getReceiptFileName(receipt.id, receipt.month));
  } catch (error) {
    console.error(
      "Téléchargement de quittance : construction du PDF impossible",
      error instanceof Error ? error.name : typeof error,
    );
    return unavailableResponse(500);
  }
}

// HEAD : le code et les en-têtes de GET, sans corps. Le serveur HTTP n'envoie
// jamais le corps d'une réponse à HEAD : la même fonction convient. Next le
// ferait de lui-même ; l'écrire rend le comportement visible.
export const HEAD = GET;

// Toute autre méthode : 405, sans rien lire ni écrire. Next répondrait 405 de
// lui-même, mais sans l'en-tête `Cache-Control` exigé par R33. OPTIONS est
// déclarée aussi : sinon Next y répondrait 204.
export const POST = methodNotAllowedResponse;
export const PUT = methodNotAllowedResponse;
export const PATCH = methodNotAllowedResponse;
export const DELETE = methodNotAllowedResponse;
export const OPTIONS = methodNotAllowedResponse;
