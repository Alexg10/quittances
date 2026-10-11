// /locations n'a pas de contenu : la liste des locations est le tableau de bord
// (R27, R35 de la spécification 03). Un propriétaire connecté y est redirigé.
import { redirect } from "next/navigation";

import {
  buildSignInPath,
  DASHBOARD_PATH,
  toSearchString,
} from "@/auth/return-path";

import { ServiceUnavailable } from "../tableau-de-bord/service-unavailable";
import { buildRentalPath, readOwnerAccess } from "./rental-access";

// Rendu bloquant, comme /tableau-de-bord : la page lit la session.
// Les deux redirections ci-dessous sont suivies par le routeur de Next, dans le
// navigateur : mesuré sur cette version, redirect() appelé par une page rendue
// sous `cacheComponents` répond 200, pas 307. La redirection HTTP, celle qui
// fonctionne sans JavaScript, est faite par le proxy (src/proxy.ts). Cette page
// reste le contrôle qui fait foi si le proxy ne s'est pas exécuté.
export const instant = false;

export default async function RentalsPage({
  searchParams,
}: PageProps<"/locations">) {
  // La page vérifie elle-même la session (R28), même si le proxy a déjà
  // redirigé les visiteurs sans cookie.
  const access = await readOwnerAccess();

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    redirect(
      buildSignInPath(buildRentalPath(), toSearchString(await searchParams)),
    );
  }
  redirect(DASHBOARD_PATH);
}
