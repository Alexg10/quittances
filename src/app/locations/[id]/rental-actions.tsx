// Groupe « Actions » du détail d'une location : un composant pour une location
// active, un autre pour une location archivée (R39, R40 et R43 de la
// spécification 04). Server Components : ils ne font que choisir quels liens
// afficher, à partir de ce que la page a calculé sur le serveur.
//
// Ce n'est qu'un affichage. Un lien absent ne protège rien : chaque page
// d'arrivée et chaque action recontrôle l'état de la location, et c'est
// l'écriture qui décide.
import Link from "next/link";

import {
  DESTRUCTIVE_BUTTON_SMALL_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "@/components/button-styles";
import type { ConfirmFormState } from "@/rentals/rental-operation-state";

import { ConfirmForm } from "./confirm-form";

type ActiveRentalActionsProps = {
  // « /locations/<id> », construit par la page avec l'identifiant lu en base.
  rentalPath: string;
  // La location a une date de fin, passée ou à venir : le lien de fin change
  // de libellé.
  hasEndDate: boolean;
  // La location est terminée, à la date du jour à Paris : elle peut être
  // archivée (R39).
  isArchivable: boolean;
  // La location a au moins une quittance : elle ne se supprime pas directement
  // (R43).
  hasReceipts: boolean;
};

// Les quatre cas de R43 :
//
//                 | sans quittance                  | avec quittance
//   en cours      | Supprimer ; phrase A            | phrases A puis B
//   terminée      | Archiver puis Supprimer         | Archiver ; phrase B
//
// Un lien est présent ou absent, jamais indisponible : un lien désactivé est un
// piège au clavier et au lecteur d'écran. Quand il manque, une phrase dit
// pourquoi et quoi faire.
export function ActiveRentalActions({
  rentalPath,
  hasEndDate,
  isArchivable,
  hasReceipts,
}: ActiveRentalActionsProps) {
  return (
    <>
      {/* Des liens, pas des boutons : chacun mène à une page (R40 de la
          spécification 03). Aucun n'agit par lui-même : afficher ou précharger
          une page ne modifie jamais rien. */}
      <div className="flex flex-wrap gap-3">
        <Link href={`${rentalPath}/modifier`} className={SECONDARY_BUTTON_CLASSES}>
          Modifier
        </Link>
        <Link href={`${rentalPath}/fin`} className={SECONDARY_BUTTON_CLASSES}>
          {hasEndDate
            ? "Modifier la fin de la location"
            : "Mettre fin à la location"}
        </Link>
        {/* Archiver n'est pas destructif : apparence secondaire (R36). */}
        {isArchivable ? (
          <Link
            href={`${rentalPath}/archiver`}
            className={SECONDARY_BUTTON_CLASSES}
          >
            Archiver
          </Link>
        ) : null}
        {hasReceipts ? null : (
          <Link
            href={`${rentalPath}/supprimer`}
            className={DESTRUCTIVE_BUTTON_SMALL_CLASSES}
          >
            Supprimer
          </Link>
        )}
      </div>
      {/* Phrase A : pourquoi il n'y a pas de lien « Archiver ». */}
      {isArchivable ? null : (
        <p className="text-text-secondary">
          Une location ne peut être archivée qu&apos;une fois terminée,
          c&apos;est-à-dire le lendemain de sa date de fin.
        </p>
      )}
      {/* Phrase B : pourquoi il n'y a pas de lien « Supprimer ». */}
      {hasReceipts ? (
        <p className="text-text-secondary">
          Une location qui a des quittances ne peut pas être supprimée
          directement. Archivez-la, puis supprimez-la depuis les archives.
        </p>
      ) : null}
    </>
  );
}

type ArchivedRentalActionsProps = {
  rentalPath: string;
  // L'action de restauration, à laquelle la page a déjà lié l'identifiant de
  // la location.
  restoreAction: (state: ConfirmFormState) => Promise<ConfirmFormState>;
};

// Une location archivée est en consultation seule (R39) : ni « Modifier », ni
// lien de fin, ni « Archiver ». Il reste deux gestes.
export function ArchivedRentalActions({
  rentalPath,
  restoreAction,
}: ArchivedRentalActionsProps) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* Un bouton, pas un lien : restaurer écrit en base, donc en POST, par un
          formulaire. Pas de page de confirmation : l'opération se défait en
          archivant de nouveau (R40). ConfirmForm est le seul Client Component
          de ce groupe : il tient l'état d'attente du bouton. */}
      <ConfirmForm
        action={restoreAction}
        label="Restaurer la location"
        pendingLabel="Restauration en cours"
        buttonClassName={SECONDARY_BUTTON_CLASSES}
      />
      {/* Un lien vers la page de confirmation : l'afficher ou la précharger ne
          supprime rien. Elle annonce le nombre de quittances (R40). */}
      <Link
        href={`${rentalPath}/supprimer`}
        className={DESTRUCTIVE_BUTTON_SMALL_CLASSES}
      >
        Supprimer définitivement
      </Link>
    </div>
  );
}
