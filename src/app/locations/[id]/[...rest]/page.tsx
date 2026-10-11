// Toute adresse sous /locations/<quelque chose>/ qui n'est pas une page connue
// (R27 de la spécification 03). Sans cette page, Next répondrait par son 404
// général, sans contrôle de session : un visiteur non connecté ne serait pas
// redirigé vers la connexion (R28).
//
// `[...rest]` capture tous les segments restants. Un dossier au nom fixe placé à
// côté (modifier, fin, supprimer) passe avant lui.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";

import { ServiceUnavailable } from "../../../tableau-de-bord/service-unavailable";
import { buildRentalPath, readOwnerAccess } from "../../rental-access";

// Même titre que pour une location introuvable, et seulement pour un
// propriétaire connecté : un visiteur ne reçoit que le titre du site.
export async function generateMetadata(): Promise<Metadata> {
  const access = await readOwnerAccess();
  if (access.kind !== "signed-in") {
    return {};
  }
  return { title: "Location introuvable — Quittances" };
}

export default async function UnknownRentalPage({
  params,
  searchParams,
}: PageProps<"/locations/[id]/[...rest]">) {
  // La session d'abord : l'identifiant n'est jamais examiné, aucune location
  // n'est lue.
  const access = await readOwnerAccess();

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    const { id, rest } = await params;
    redirect(
      buildSignInPath(
        buildRentalPath(id, ...rest),
        toSearchString(await searchParams),
      ),
    );
  }
  // Même réponse que pour une location introuvable : 404 et ../not-found.tsx.
  notFound();
}
