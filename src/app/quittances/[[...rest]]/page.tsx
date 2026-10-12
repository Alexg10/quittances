// Toute adresse sous /quittances qui n'est pas une page connue : /quittances,
// /quittances/<q>, /quittances/<q>/autre (R24 de la spécification 04). Sans
// cette page, Next répondrait par son 404 général, sans contrôle de session :
// un visiteur non connecté ne serait pas redirigé vers la connexion.
//
// `[[...rest]]` capture zéro, un ou plusieurs segments. Les adresses plus
// précises passent avant lui : [id]/supprimer (page) et [id]/pdf (Route Handler).
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { buildSignInPath, toSearchString } from "@/auth/return-path";

import { readOwnerAccess } from "../../locations/rental-access";
import { ServiceUnavailable } from "../../tableau-de-bord/service-unavailable";
import { buildReceiptPath } from "../receipt-access";

// Même titre que pour une quittance introuvable, et seulement pour un
// propriétaire connecté : un visiteur ne reçoit que le titre du site.
export async function generateMetadata(): Promise<Metadata> {
  const access = await readOwnerAccess();
  if (access.kind !== "signed-in") {
    return {};
  }
  return { title: "Quittance introuvable — Quittances" };
}

export default async function UnknownReceiptPage({
  params,
  searchParams,
}: PageProps<"/quittances/[[...rest]]">) {
  // La session d'abord : l'adresse n'est jamais examinée, aucune quittance
  // n'est lue.
  const access = await readOwnerAccess();

  if (access.kind === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (access.kind === "signed-out") {
    // `rest` est absent pour /quittances.
    const { rest = [] } = await params;
    redirect(
      buildSignInPath(
        buildReceiptPath(...rest),
        toSearchString(await searchParams),
      ),
    );
  }
  // Code 404 et écran de ../not-found.tsx.
  notFound();
}
