// Page 404 générale : ce que Next affiche pour une adresse qui ne correspond à
// aucune page (code HTTP 404). Elle remplace la page par défaut, en anglais.
// Elle est publique et ne lit pas la session : elle ne dit donc rien du compte
// et renvoie à l'accueil, qui convient à un visiteur comme à un propriétaire.
// L'écran « Location introuvable » n'est pas concerné : sous /locations/<id>,
// c'est le fichier not-found.tsx le plus proche de la page qui s'applique.
import type { Metadata } from "next";
import Link from "next/link";

import { LogoLink } from "./logo-link";

export const metadata: Metadata = {
  title: "Page introuvable — Quittances",
};

export default function NotFound() {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center px-6">
          <LogoLink />
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <h1 className="font-display text-subtitle font-bold md:text-title">
          Page introuvable
        </h1>
        <p className="text-text-secondary">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <Link href="/" className="text-primary underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    </>
  );
}
