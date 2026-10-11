// État vide du tableau de bord (R35) : aucune location dans le compte.
// Le lien a l'apparence d'un bouton primaire mais reste un lien : il change de
// page (R40).
import Link from "next/link";

import { PRIMARY_BUTTON_LINK_CLASSES } from "@/components/button-styles";

export function EmptyRentals() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
      <h2 className="font-display text-body font-bold">
        Aucune location pour l&apos;instant
      </h2>
      <p className="text-text-secondary">
        Ajoutez votre première location pour préparer vos quittances.
      </p>
      <Link
        href="/locations/nouvelle"
        className={`${PRIMARY_BUTTON_LINK_CLASSES} mt-2`}
      >
        Ajouter une location
      </Link>
    </div>
  );
}
