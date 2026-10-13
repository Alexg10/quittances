// Messages M2 à M5 de la spécification 05 (« Messages »), partagés par l'action
// d'envoi et la page. Un fichier à part : un fichier "use server" ne peut
// exporter que des fonctions asynchrones. E8 est dans auth/messages.
export const SEND_MESSAGES = {
  M2: "Le message n'a pas pu être envoyé. Rien n'est perdu : réessayez dans quelques instants.",
  M3: "L'adresse e-mail du locataire a été refusée. Vérifiez-la dans la location, puis réessayez.",
  M4: "L'envoi par e-mail n'est pas disponible pour le moment. Vous pouvez télécharger la quittance.",
  M5: "Le message est probablement parti, mais l'envoi n'a pas pu être enregistré. Vérifiez auprès de votre locataire avant de le renvoyer.",
} as const;
