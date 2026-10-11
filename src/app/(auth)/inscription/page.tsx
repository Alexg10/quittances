// Page publique de création de compte. Server Component statique : le titre,
// les textes et le lien sont rendus au build ; seul le formulaire est client.
import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Créer un compte — Quittances",
};

export default function SignUpPage() {
  return (
    <>
      <h1 className="font-display text-subtitle font-bold md:text-title">
        Créer un compte
      </h1>
      <p className="text-text-secondary">
        Un compte par propriétaire, pour toutes vos locations.
      </p>

      <SignUpForm />

      <p className="text-small text-text-secondary">
        Vous avez déjà un compte.{" "}
        <Link href="/connexion" className="text-primary underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
