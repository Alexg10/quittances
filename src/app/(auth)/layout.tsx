// Mise en page commune à /inscription et /connexion (R35, R36 de la
// spécification 02) : l'en-tête réduit au logo, puis une carte centrée qui
// contient tout l'écran, titre compris.
// « (auth) » est un groupe de routes : le dossier range les pages et leur donne
// ce layout, sans apparaître dans leur adresse.
// Server Component : seul le logo, déjà isolé dans LogoLink, est client.
import { LogoLink } from "../logo-link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Même barre que sur l'accueil (fixe, 56px, fond translucide, filet bas),
          sans navigation ni lien d'évitement. */}
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center px-6">
          <LogoLink />
        </div>
      </header>

      {/* px-6 : la carte reste à 24px au moins de chaque bord de la fenêtre. */}
      <main className="px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <div className="mx-auto flex max-w-100 flex-col gap-6 rounded-xl border border-border bg-surface p-6">
          {children}
        </div>
      </main>
    </>
  );
}
