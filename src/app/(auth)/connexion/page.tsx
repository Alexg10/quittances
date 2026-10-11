// Page publique de connexion. Server Component statique : le titre, les textes
// et le lien sont rendus au build ; seul le formulaire est client.
//
// La page ne lit volontairement pas le paramètre `retour` de son adresse, et
// reste ainsi statique. Le lire la rendrait dynamique, et Next ne réaffiche
// pas les erreurs d'un formulaire envoyé sans JavaScript sur une page
// dynamique (constaté sur le build de production, voir R29). C'est la Server
// Action qui retrouve `retour` au moment de l'envoi (./actions).
import type { Metadata } from "next";
import Link from "next/link";

import { SIGN_UP_PATH } from "@/auth/return-path";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Connexion — Quittances",
};

export default function SignInPage() {
  return (
    <>
      <h1 className="font-display text-subtitle font-bold md:text-title">
        Connexion
      </h1>

      <SignInForm />

      <p className="text-small text-text-secondary">
        La réinitialisation du mot de passe n&apos;est pas encore disponible.
      </p>

      <p className="text-small text-text-secondary">
        Pas encore de compte.{" "}
        {/* Sans paramètre `retour` : l'inscription mène toujours au tableau de
            bord (R11). */}
        <Link href={SIGN_UP_PATH} className="text-primary underline">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
