"use client";

// Bouton « Réessayer » de l'écran de panne. Client Component : il réagit à un
// clic. C'est le seul élément de l'écran de panne qui en a besoin.
import { useRouter } from "next/navigation";

import { SECONDARY_BUTTON_CLASSES } from "@/components/button-styles";

type RetryButtonProps = {
  // Fournie par error.tsx : la fonction `retry` de Next, qui redemande au
  // serveur le contenu en erreur. Absente quand c'est la page elle-même qui
  // affiche l'écran de panne : on redemande alors la page au serveur.
  retry?: () => void;
};

export function RetryButton({ retry }: RetryButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      // router.refresh() redemande la page au serveur sans recharger le
      // document : si la base répond de nouveau, le contenu remplace l'écran.
      onClick={() => (retry ? retry() : router.refresh())}
      className={SECONDARY_BUTTON_CLASSES}
    >
      Réessayer
    </button>
  );
}
