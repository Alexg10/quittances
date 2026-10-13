// Date d'accord du locataire pour l'envoi par e-mail (R1 et R2 de la
// spécification 05). Fonction pure : l'instant est passé en paramètre, rien ne
// lit l'horloge ici.

type ResolveEmailConsentInput = {
  // La case du formulaire. Seule source de la décision : jamais une date reçue.
  given: boolean;
  // L'instant de la demande, lu sur l'horloge du serveur par l'action.
  now: Date;
  // L'état enregistré AVANT cette écriture, relu en base sous le verrou de la
  // location. Absent à la création.
  previous?: { tenantEmail: string; emailConsentAt: Date | null };
  // L'adresse qui va être enregistrée, déjà normalisée.
  tenantEmail: string;
};

// Date d'accord à enregistrer, ou null si l'accord est absent ou retiré.
export function resolveEmailConsentAt({
  given,
  now,
  previous,
  tenantEmail,
}: ResolveEmailConsentInput): Date | null {
  // Case décochée : l'accord est effacé, que l'adresse change ou non (R1, R2).
  if (!given) {
    return null;
  }
  // Case cochée, adresse inchangée et accord déjà daté : la date ne bouge pas.
  // Une adresse modifiée est une nouvelle attestation (R2) : date renouvelée.
  if (
    previous !== undefined &&
    previous.emailConsentAt !== null &&
    previous.tenantEmail === tenantEmail
  ) {
    return previous.emailConsentAt;
  }
  return now;
}
