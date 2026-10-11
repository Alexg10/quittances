// Espace réservé du propriétaire (T3 de la spécification 02). Volontairement
// presque vide : il prouve que la session fonctionne et pose la règle
// d'isolation entre comptes.
//
// Server Component, rendu à chaque requête : ce qu'il affiche dépend du cookie
// de session. Seuls le logo et le formulaire de déconnexion sont des Client
// Components.
import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";

import { getCurrentOwner, type Owner } from "@/auth/current-owner";
import {
  buildSignInPath,
  DASHBOARD_PATH,
  toSearchString,
} from "@/auth/return-path";

import { DashboardHeader } from "./dashboard-header";
import { ServiceUnavailable } from "./service-unavailable";
import { SignOutForm } from "./sign-out-form";

// Rendu bloquant, voulu. Avec `cacheComponents`, Next attend d'ordinaire que la
// lecture de la session soit placée sous <Suspense> : le contenu arrive alors
// dans un bloc masqué, qu'un script révèle. Sans JavaScript, le propriétaire
// ne verrait que l'état de chargement, et pas le bouton « Se déconnecter »
// (R29). `instant = false` déclare que cette page peut faire attendre la
// navigation : le serveur envoie le contenu complet, directement visible.
// Conséquence : cette page n'a pas d'état de chargement.
export const instant = false;

// Le titre dépend de la session : un visiteur non connecté ne doit pas même
// recevoir « Tableau de bord » dans le titre du document (R23).
export async function generateMetadata(): Promise<Metadata> {
  const owner = await readOwner();
  if (owner === "unavailable" || owner === null) {
    // Le titre par défaut du site, défini dans le layout racine, s'applique.
    return {};
  }
  return { title: "Tableau de bord — Quittances" };
}

export default async function DashboardPage({
  searchParams,
}: PageProps<"/tableau-de-bord">) {
  // La page vérifie elle-même la session (R2), même si le proxy a déjà
  // redirigé les visiteurs sans cookie : lui n'est qu'un confort.
  const owner = await readOwner();

  if (owner === "unavailable") {
    return <ServiceUnavailable />;
  }
  if (owner === null) {
    // redirect() fonctionne en levant une erreur : il est appelé hors de tout
    // try, qui l'intercepterait.
    redirect(
      buildSignInPath(DASHBOARD_PATH, toSearchString(await searchParams)),
    );
  }

  return (
    <>
      <DashboardHeader>
        {/* Seul élément client de la page, avec le logo. */}
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <h1 className="font-display text-subtitle font-bold md:text-title">
          Tableau de bord
        </h1>
        {/* wrap-anywhere : une adresse longue passe à la ligne au lieu de
            créer un défilement horizontal. */}
        <p className="wrap-anywhere text-text-secondary">
          Connecté en tant que{" "}
          <span className="text-text-primary">{owner.email}</span>
        </p>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-body font-bold">
            Aucune location pour l&apos;instant
          </h2>
          <p className="text-text-secondary">
            L&apos;ajout de locations arrivera dans une prochaine version.
          </p>
        </div>
      </main>
    </>
  );
}

// Le propriétaire courant, null sans session, ou "unavailable" si la session
// n'a pas pu être vérifiée (base injoignable). Une panne est un cas attendu :
// elle est rendue comme un état de la page, pas comme une exception.
// getCurrentOwner() est mémorisée le temps de la requête : generateMetadata et
// la page partagent une seule lecture en base.
async function readOwner(): Promise<Owner | null | "unavailable"> {
  try {
    return await getCurrentOwner();
  } catch (error) {
    // Next signale certaines situations par des erreurs internes (une page
    // rendue hors requête pendant le build, par exemple) : on les lui rend.
    unstable_rethrow(error);
    // On ne journalise que le type de l'erreur : son message peut contenir
    // des détails de connexion.
    console.error(
      "Tableau de bord : session non vérifiable",
      error instanceof Error ? error.name : typeof error,
    );
    return "unavailable";
  }
}
