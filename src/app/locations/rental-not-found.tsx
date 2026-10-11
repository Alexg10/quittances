// Écran « Location introuvable » (R5 de la spécification 03). Le même, mot pour
// mot, pour la location d'un autre compte, une location supprimée, un
// identifiant inconnu et un identifiant mal formé : il ne reçoit aucune prop, il
// ne peut donc rien afficher qui dépende de la demande.
// Il garde l'en-tête complet (R42) : seul un propriétaire connecté le voit.
// Les pages le rendent elles-mêmes, après avoir contrôlé la session.
import Link from "next/link";

import { DASHBOARD_PATH } from "@/auth/return-path";

import { DashboardHeader } from "../tableau-de-bord/dashboard-header";
import { SignOutForm } from "../tableau-de-bord/sign-out-form";

export function RentalNotFound() {
  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <h1 className="font-display text-subtitle font-bold md:text-title">
          Location introuvable
        </h1>
        <p className="text-text-secondary">
          Cette location n&apos;existe pas ou a été supprimée.
        </p>
        <Link href={DASHBOARD_PATH} className="text-primary underline">
          Retour au tableau de bord
        </Link>
      </main>
    </>
  );
}
