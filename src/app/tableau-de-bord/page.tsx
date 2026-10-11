// Forme PROVISOIRE de l'espace réservé (T2 de la spécification 02) : elle sert
// de destination à l'inscription. Son contenu définitif (en-tête, titre, état
// vide, écran de panne, paramètre « retour ») arrive avec T3.
// Elle est en revanche déjà protégée.
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentOwner } from "@/auth/current-owner";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      {/* Lire la session dépend de la requête : cette partie ne peut pas être
          pré-rendue au build. Sous <Suspense>, elle est calculée à chaque
          requête et le reste de la page reste statique. */}
      <Suspense fallback={<p>Chargement en cours</p>}>
        <ConnectedAs />
      </Suspense>
    </main>
  );
}

async function ConnectedAs() {
  // La page vérifie elle-même la session (R2) : sans propriétaire, rien de privé
  // n'est rendu.
  const owner = await getCurrentOwner();
  if (!owner) {
    redirect("/connexion");
  }

  return (
    <p className="break-words text-text-secondary">
      Connecté en tant que{" "}
      <span className="text-text-primary">{owner.email}</span>
    </p>
  );
}
