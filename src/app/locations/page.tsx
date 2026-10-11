// /locations n'a pas de contenu : la liste des locations est le tableau de bord
// (R27, R35 de la spécification 03). Un propriétaire connecté y est redirigé.
// La page est rendue à chaque requête (elle lit la session) : redirect() y
// répond par une vraie redirection HTTP 307, suivie sans JavaScript.
import { redirect } from "next/navigation";

import {
  buildSignInPath,
  DASHBOARD_PATH,
  toSearchString,
} from "@/auth/return-path";

import { ServiceUnavailable } from "../tableau-de-bord/service-unavailable";
import { buildRentalPath, readOwnerAccess } from "./rental-access";

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
