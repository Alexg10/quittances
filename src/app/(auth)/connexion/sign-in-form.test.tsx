import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthFormState } from "@/auth/form-state";
import { ERROR_MESSAGES } from "@/auth/messages";

import SignInPage from "./page";

// Simulé : la Server Action importe `server-only` et la base, qui ne se
// chargent pas sous Vitest. On ne teste donc pas la vraie action, seulement ce
// que le formulaire affiche selon l'état qu'elle renvoie.
const { signIn } = vi.hoisted(() => ({
  signIn: vi.fn<(previous: AuthFormState, formData: FormData) => Promise<AuthFormState>>(),
}));
vi.mock("./actions", () => ({ signIn }));

beforeEach(() => {
  signIn.mockReset();
});

const emailField = () => screen.getByRole("textbox", { name: "Adresse e-mail" });
const passwordField = () => screen.getByLabelText("Mot de passe");
const submit = () => screen.getByRole("button", { name: "Se connecter" });

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(emailField(), email);
  if (password) await user.type(passwordField(), password);
  await user.click(submit());
}

describe("Page de connexion — contenus (CA23)", () => {
  it("CA23 — le h1 est « Connexion », seul titre de la page", () => {
    render(<SignInPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Connexion" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("CA23 — le champ e-mail : type email, autocomplete username, name email, obligatoire, vide, sans placeholder", () => {
    render(<SignInPage />);

    const champ = emailField();
    expect(champ).toHaveAttribute("type", "email");
    expect(champ).toHaveAttribute("autocomplete", "username");
    expect(champ).toHaveAttribute("name", "email");
    expect(champ).toBeRequired();
    expect(champ).toHaveValue("");
    expect(champ).not.toHaveAttribute("placeholder");
  });

  it("CA23 — le champ mot de passe : type password, autocomplete current-password (pas new-password), name password, obligatoire, vide, sans placeholder", () => {
    render(<SignInPage />);

    const champ = passwordField();
    expect(champ).toHaveAttribute("type", "password");
    expect(champ).toHaveAttribute("autocomplete", "current-password");
    expect(champ).not.toHaveAttribute("autocomplete", "new-password");
    expect(champ).toHaveAttribute("name", "password");
    expect(champ).toBeRequired();
    expect(champ).toHaveValue("");
    expect(champ).not.toHaveAttribute("placeholder");
  });

  it("CA23 — le mot de passe n'a pas de texte d'aide", () => {
    render(<SignInPage />);

    expect(passwordField()).toHaveAccessibleDescription("");
  });

  it("CA23 — le bouton d'envoi s'appelle « Se connecter » et est actif", () => {
    render(<SignInPage />);

    expect(submit()).toBeEnabled();
    expect(submit()).toHaveAttribute("type", "submit");
  });

  it("CA23 / R15 — affiche la phrase sur la réinitialisation, mot pour mot", () => {
    render(<SignInPage />);

    expect(
      screen.getByText("La réinitialisation du mot de passe n'est pas encore disponible."),
    ).toBeInTheDocument();
  });

  it("CA23 — le bas de carte : « Pas encore de compte. » puis le lien « Créer un compte » vers /inscription, sans paramètre", () => {
    render(<SignInPage />);

    expect(screen.getByText(/Pas encore de compte\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Créer un compte" })).toHaveAttribute(
      "href",
      "/inscription",
    );
  });

  it("CA23 / R15 — aucun lien ni bouton dont le nom contient « oublié »", () => {
    render(<SignInPage />);

    const interactifs = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")];
    for (const element of interactifs) {
      expect(element).not.toHaveAccessibleName(/oubli/i);
    }
  });

  it("CA23 — cas « déjà là » : aucun lien vers /connexion", () => {
    render(<SignInPage />);

    const hrefs = screen.getAllByRole("link").map((lien) => lien.getAttribute("href"));
    expect(hrefs).toEqual(["/inscription"]);
  });

  it("CA23 / R8 — le bouton d'affichage est présent, masqué par défaut, et ne ressemble pas à un envoi", () => {
    render(<SignInPage />);

    const bouton = screen.getByRole("button", { name: "Afficher le mot de passe" });
    expect(bouton).toHaveTextContent("Afficher");
    expect(bouton).toHaveAttribute("type", "button");
  });

  it("CA23 — état initial : aucun message, aucun champ focalisé, aucun champ en erreur", () => {
    render(<SignInPage />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    expect(document.body).toHaveFocus();
  });

  it("R14 — aucun champ caché dans le formulaire : la destination n'est pas choisie par le formulaire", () => {
    render(<SignInPage />);

    const formulaire = submit().closest("form");
    expect(formulaire).not.toBeNull();
    expect(formulaire?.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
    // Seuls les champs attendus portent un nom (hors identifiants internes de React).
    const noms = [...(formulaire?.elements ?? [])]
      .map((element) => element.getAttribute("name"))
      .filter((nom): nom is string => nom !== null && !nom.startsWith("$"));
    expect(noms.sort()).toEqual(["email", "password"]);
  });

  it("R9 — le formulaire désactive la validation native du navigateur", () => {
    render(<SignInPage />);

    expect(submit().closest("form")).toHaveAttribute("novalidate");
  });

  it("R30 — ordre de tabulation : e-mail, mot de passe, Afficher, envoi, lien", async () => {
    const user = userEvent.setup();
    render(<SignInPage />);

    await user.tab();
    expect(emailField()).toHaveFocus();
    await user.tab();
    expect(passwordField()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Afficher le mot de passe" })).toHaveFocus();
    await user.tab();
    expect(submit()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Créer un compte" })).toHaveFocus();
  });
});

describe("Formulaire de connexion — affichage du mot de passe (CA15)", () => {
  it("CA15 — « Afficher » rend la saisie lisible sans envoyer, « Masquer » la masque, valeur inchangée", async () => {
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(passwordField(), "mon secret");

    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(passwordField()).toHaveAttribute("type", "text");
    expect(passwordField()).toHaveValue("mon secret");
    expect(screen.getByRole("button", { name: "Masquer le mot de passe" })).toHaveTextContent("Masquer");

    await user.click(screen.getByRole("button", { name: "Masquer le mot de passe" }));
    expect(passwordField()).toHaveAttribute("type", "password");
    expect(passwordField()).toHaveValue("mon secret");
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("Formulaire de connexion — envoi", () => {
  it("transmet l'adresse et le mot de passe saisis à l'action, tels quels, et rien d'autre", async () => {
    signIn.mockResolvedValue({ email: "x" });
    render(<SignInPage />);

    await fillAndSubmit("Marie@Exemple.FR", " mot de passe ");

    expect(signIn).toHaveBeenCalledTimes(1);
    const formData = signIn.mock.calls[0][1];
    expect(formData.get("email")).toBe("Marie@Exemple.FR");
    expect(formData.get("password")).toBe(" mot de passe ");
    expect(formData.has("retour")).toBe(false);
  });

  it("R28 — pendant l'attente : « Connexion en cours », bouton désactivé, valeurs conservées", async () => {
    // Réponse retardée par le test, résolue à la fin pour ne pas bloquer la
    // file des actions de React pour les tests suivants.
    let respond: (state: AuthFormState) => void = () => {};
    signIn.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    render(<SignInPage />);

    await fillAndSubmit("marie@exemple.fr", "motdepasse-long");

    const bouton = await screen.findByRole("button", { name: "Connexion en cours" });
    expect(bouton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Connexion en cours");
    expect(emailField()).toHaveValue("marie@exemple.fr");
    expect(passwordField()).toHaveValue("motdepasse-long");

    await act(async () => respond({ email: "marie@exemple.fr" }));
  });

  it("R28 — deux activations rapides ne produisent qu'un seul appel", async () => {
    let respond: (state: AuthFormState) => void = () => {};
    signIn.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(emailField(), "marie@exemple.fr");
    await user.type(passwordField(), "motdepasse-long");

    await user.click(submit());
    await user.click(await screen.findByRole("button", { name: "Connexion en cours" }));

    expect(signIn).toHaveBeenCalledTimes(1);

    await act(async () => respond({ email: "marie@exemple.fr" }));
  });
});

describe("Formulaire de connexion — erreurs renvoyées par l'action", () => {
  it("CA25 — E1 et E4 : chaque message sous son champ, aria-invalid, focus sur l'e-mail, pas de E7", async () => {
    signIn.mockResolvedValue({
      email: "",
      emailError: ERROR_MESSAGES.E1,
      passwordError: ERROR_MESSAGES.E4,
    });
    render(<SignInPage />);

    await fillAndSubmit("", "");

    expect(await screen.findByText(ERROR_MESSAGES.E1)).toBeInTheDocument();
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
    expect(emailField()).toHaveAccessibleDescription(ERROR_MESSAGES.E1);
    expect(passwordField()).toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).toHaveAccessibleDescription(ERROR_MESSAGES.E4);
    expect(emailField()).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(ERROR_MESSAGES.E7)).not.toBeInTheDocument();
  });

  it("R27 — seul E4 : le focus va sur le mot de passe, l'adresse est conservée", async () => {
    signIn.mockResolvedValue({ email: "marie@exemple.fr", passwordError: ERROR_MESSAGES.E4 });
    render(<SignInPage />);

    await fillAndSubmit("marie@exemple.fr", "");

    expect(await screen.findByText(ERROR_MESSAGES.E4)).toBeInTheDocument();
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).toHaveFocus();
    expect(emailField()).toHaveValue("marie@exemple.fr");
  });

  it("CA25 — E7 : message de formulaire (alert) avant les champs, avec le focus, rien sous les champs, adresse conservée, mot de passe vidé", async () => {
    signIn.mockResolvedValue({ email: "marie@exemple", formError: ERROR_MESSAGES.E7 });
    render(<SignInPage />);

    await fillAndSubmit("marie@exemple", "mauvais-mot-de-passe");

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(ERROR_MESSAGES.E7);
    expect(alerte).toHaveTextContent("Adresse e-mail ou mot de passe incorrect.");
    expect(alerte).toHaveFocus();
    expect(
      alerte.compareDocumentPosition(emailField()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(emailField()).toHaveValue("marie@exemple");
    expect(passwordField()).toHaveValue("");
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    expect(emailField()).toHaveAccessibleDescription("");
    expect(passwordField()).toHaveAccessibleDescription("");
  });

  it("R25 — une panne (E8) s'affiche comme E7 : alert, focus, adresse conservée, mot de passe vidé", async () => {
    signIn.mockResolvedValue({ email: "marie@exemple.fr", formError: ERROR_MESSAGES.E8 });
    render(<SignInPage />);

    await fillAndSubmit("marie@exemple.fr", "motdepasse-long");

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(
      "Le service est momentanément indisponible. Réessayez dans quelques instants.",
    );
    expect(alerte).toHaveFocus();
    expect(emailField()).toHaveValue("marie@exemple.fr");
    expect(passwordField()).toHaveValue("");
  });

  it("R25 — E7 disparaît à la soumission suivante si elle réussit", async () => {
    signIn
      .mockResolvedValueOnce({ email: "marie@exemple.fr", formError: ERROR_MESSAGES.E7 })
      .mockResolvedValueOnce({ email: "marie@exemple.fr" });
    const user = userEvent.setup();
    render(<SignInPage />);

    await user.type(emailField(), "marie@exemple.fr");
    await user.type(passwordField(), "faux");
    await user.click(submit());
    await screen.findByRole("alert");

    await user.type(passwordField(), "bon-mot-de-passe");
    await user.click(submit());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("R25 — pas de validation pendant la frappe", async () => {
    const user = userEvent.setup();
    render(<SignInPage />);

    await user.type(emailField(), "pas-une-adresse");
    await user.tab();

    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(signIn).not.toHaveBeenCalled();
  });
});
