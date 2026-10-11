// En-tête de l'espace réservé (R36 de la spécification 02) : la même barre que
// sur l'accueil (fixe, 56px, fond translucide, filet bas), le logo à gauche et,
// à droite, ce que la page lui confie.
// Sans état ni événement : pas de "use client". Seul le logo est client.
import type { ReactNode } from "react";

import { DASHBOARD_PATH } from "@/auth/return-path";

import { LogoLink } from "../logo-link";

type DashboardHeaderProps = {
  // Le bouton « Se déconnecter », quand un propriétaire est connecté. Absent
  // sur l'écran de panne, dont l'en-tête n'affiche que le logo.
  children?: ReactNode;
};

export function DashboardHeader({ children }: DashboardHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        {/* Déjà sur /tableau-de-bord, activer le logo y laisse et remonte en
            haut de page, sans recharger le document. */}
        <LogoLink href={DASHBOARD_PATH} label="Quittances, tableau de bord" />
        {children}
      </div>
    </header>
  );
}
