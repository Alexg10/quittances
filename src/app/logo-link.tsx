"use client";

import Link from "next/link";

// Client Component minimal : seul le logo a besoin d'un gestionnaire d'événement.
// Link conserve la position de défilement quand la page visée est déjà visible
// (doc Next, Link > scroll) : on ramène donc nous-mêmes le défilement à 0.
// onNavigate ne s'exécute que pour une navigation côté client : un Cmd/Ctrl + clic
// ou un clic du milieu (nouvel onglet) ne fait pas défiler la page courante.
// Sans animation (pas de behavior: "smooth"), conformément à R25 et R30.
export function LogoLink() {
  return (
    <Link
      href="/"
      aria-label="Quittances, accueil"
      className="rounded-md font-display text-subtitle font-bold"
      onNavigate={() => window.scrollTo(0, 0)}
    >
      Quittances
    </Link>
  );
}
