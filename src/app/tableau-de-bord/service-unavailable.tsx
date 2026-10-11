// Écran de panne de l'espace réservé (R24 de la spécification 02) : la base ne
// répond pas, aucun contenu protégé n'est affiché. L'en-tête n'a que le logo.
// Sans directive : rendu sur le serveur quand la page l'affiche, et dans le
// navigateur quand c'est error.tsx.
import { DashboardHeader } from "./dashboard-header";
import { RetryButton } from "./retry-button";

type ServiceUnavailableProps = {
  // Voir RetryButton.
  retry?: () => void;
};

export function ServiceUnavailable({ retry }: ServiceUnavailableProps) {
  return (
    <>
      <DashboardHeader />
      <main className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 pb-8 pt-22 md:pb-12 md:pt-26">
        <h1 className="font-display text-subtitle font-bold md:text-title">
          Service momentanément indisponible
        </h1>
        <p className="text-text-secondary">
          Cette page ne peut pas être affichée pour le moment.
        </p>
        <RetryButton retry={retry} />
      </main>
    </>
  );
}
