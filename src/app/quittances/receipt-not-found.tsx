// Écran « Quittance introuvable » (R22 de la spécification 04). Le même, mot
// pour mot, pour la quittance d'un autre compte, une quittance supprimée, un
// identifiant inconnu et un identifiant mal formé : il ne reçoit aucune prop, il
// ne peut donc rien afficher qui dépende de la demande.
// Il garde l'en-tête complet : seul un propriétaire connecté le voit. Les pages
// contrôlent la session avant d'appeler notFound(), qui l'affiche
// (voir ./not-found.tsx).
import Link from "next/link";

import { DASHBOARD_PATH } from "@/auth/return-path";

import { DashboardHeader } from "../tableau-de-bord/dashboard-header";
import { SignOutForm } from "../tableau-de-bord/sign-out-form";

export function ReceiptNotFound() {
  return (
    <>
      <DashboardHeader>
        <SignOutForm />
      </DashboardHeader>

      <main className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <h1 className="font-display text-subtitle font-bold md:text-title">
          Quittance introuvable
        </h1>
        <p className="text-text-secondary">
          Cette quittance n&apos;existe pas ou a été supprimée.
        </p>
        <Link href={DASHBOARD_PATH} className="text-primary underline">
          Retour au tableau de bord
        </Link>
      </main>
    </>
  );
}
