// Page d'accueil publique : Server Component statique, sans JavaScript côté navigateur.
// Le lien d'évitement et l'en-tête appartiennent à cette page, pas au layout racine (R13).

import { LogoLink } from "./logo-link";

const steps = [
  {
    title: "Vous recevez un e-mail le jour J",
    text: "Vous choisissez le jour d'échéance de chaque location. Ce jour-là, Quittances vous demande si le loyer a bien été reçu.",
  },
  {
    title: "Vous confirmez, ou non, le loyer",
    text: "Rien ne part sans votre réponse. C'est vous qui pointez chaque paiement.",
  },
  {
    title: "Votre locataire reçoit le bon e-mail",
    text: "Si le loyer est confirmé, la quittance en PDF lui est envoyée. Sinon, il reçoit une relance. Il n'a aucun compte à créer.",
  },
];

const features = [
  {
    title: "Plusieurs locations, un seul compte",
    text: "Suivez tous vos biens au même endroit, chacun avec son locataire, son loyer et son jour d'échéance.",
  },
  {
    title: "Quittances en PDF",
    text: "Une quittance prête à imprimer, envoyée par e-mail à votre locataire dès que vous confirmez le loyer.",
  },
  {
    title: "Relances des loyers non reçus",
    text: "Si vous indiquez que le loyer n'est pas arrivé, votre locataire reçoit un e-mail de relance.",
  },
  {
    title: "Tableau de bord et exports",
    text: "Voyez d'un coup d'œil les loyers reçus et les impayés, et exportez-les.",
  },
];

const h2Classes =
  "font-display text-subtitle font-bold md:text-title";

export default function Home() {
  return (
    <>
      {/* Premier élément focalisable : de taille nulle tant qu'il n'a pas le focus. */}
      <a
        href="#contenu"
        className="fixed left-6 top-2 z-50 h-0 w-0 overflow-hidden focus:h-auto focus:w-auto focus:rounded-md focus:border focus:border-border focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
      >
        Aller au contenu
      </a>

      {/* header hors de main et de toute section : il reste un repère banner (R22). */}
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <LogoLink />
          {/* Dans le DOM à toutes les largeurs ; display:none sous 768px la retire de l'affichage et de la tabulation. */}
          <nav aria-label="Navigation principale" className="hidden md:block">
            <ul className="flex items-center gap-2">
              <li>
                <a
                  href="#fonctionnement"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-border"
                >
                  Fonctionnement
                </a>
              </li>
              <li>
                <a
                  href="#fonctionnalites"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-border"
                >
                  Fonctionnalités
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main
        id="contenu"
        className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-8 pt-22 md:gap-12 md:pb-12 md:pt-26 lg:gap-16 lg:pb-16 lg:pt-30"
      >
        <section className="flex flex-col items-start gap-6">
          <p className="text-overline font-medium uppercase text-text-secondary">
            Pour les propriétaires bailleurs
          </p>
          <h1 className="max-w-240 text-balance font-display text-display-sm font-bold md:text-display-md lg:text-display">
            Vos quittances de loyer, envoyées sans y penser.
          </h1>
          <p className="max-w-160 text-body text-text-secondary">
            Le jour de l&apos;échéance, Quittances vous demande par e-mail si le
            loyer est arrivé. Vous confirmez, la quittance PDF part chez votre
            locataire. Sinon, il reçoit une relance.
          </p>
          <a
            href="#fonctionnement"
            className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-body font-medium text-surface transition-[background-color,translate] duration-200 hover:bg-primary-hover hover:shadow-primary-glow motion-safe:hover:-translate-y-px motion-reduce:duration-0"
          >
            Voir comment ça marche
          </a>
        </section>

        <section
          id="fonctionnement"
          aria-labelledby="titre-fonctionnement"
          className="flex flex-col gap-6"
        >
          <h2 id="titre-fonctionnement" className={h2Classes}>
            Comment ça marche
          </h2>
          <p className="text-text-secondary">
            Trois étapes, une fois par mois et par location.
          </p>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span
                  aria-hidden="true"
                  className="font-display text-subtitle font-bold"
                >
                  {index + 1}
                </span>
                <h3 className="font-display text-body font-bold">
                  {step.title}
                </h3>
                <p className="text-text-secondary">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="fonctionnalites"
          aria-labelledby="titre-fonctionnalites"
          className="flex flex-col gap-6"
        >
          <h2 id="titre-fonctionnalites" className={h2Classes}>
            Ce que fait Quittances
          </h2>
          <ul className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <li
                key={feature.title}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-6"
              >
                <h3 className="font-display text-body font-bold">
                  {feature.title}
                </h3>
                <p className="text-text-secondary">{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="inscriptions"
          aria-labelledby="titre-inscriptions"
          className="flex flex-col gap-6"
        >
          <h2 id="titre-inscriptions" className={h2Classes}>
            Les inscriptions ouvrent bientôt
          </h2>
          <p className="text-text-secondary">
            Quittances est en cours de développement. La création de compte
            n&apos;est pas encore disponible.
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <p className="mx-auto max-w-7xl px-6 py-8 text-small text-text-secondary">
          Quittances, l&apos;envoi des quittances de loyer et des relances pour
          les propriétaires bailleurs.
        </p>
      </footer>
    </>
  );
}
