import { useEffect, type RefObject } from "react";

// Hook : il n'a de sens que dans un Client Component, et c'est le composant qui
// l'appelle qui porte "use client".
//
// Après une soumission refusée, place le focus là où l'utilisateur doit agir
// (R27) : sur le message de formulaire s'il y en a un, sinon sur le premier
// champ en erreur.
//
// querySelector renvoie le premier élément dans l'ordre du document. Le message
// de formulaire (role="alert") est placé avant les champs, et un champ en
// erreur porte aria-invalid="true" : l'ordre du document est donc l'ordre voulu.
//
// `state` est l'état renvoyé par la Server Action : un nouvel objet à chaque
// réponse, ce qui relance l'effet même si les erreurs sont identiques.
// Sans erreur (premier affichage), rien n'est trouvé et aucun champ ne prend le
// focus.
export function useFocusOnError(
  formRef: RefObject<HTMLFormElement | null>,
  state: object,
): void {
  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLElement>('[role="alert"], [aria-invalid="true"]')
      ?.focus();
  }, [formRef, state]);
}
