import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthFormState } from "@/auth/form-state";
import { ERROR_MESSAGES } from "@/auth/messages";

import SignUpPage from "./page";

// Simulé : la Server Action importe `server-only` et la base, qui ne se
// chargent pas sous Vitest. On ne teste donc pas la vraie action, seulement ce
// que le formulaire affiche selon l'état qu'elle renvoie.
const { signUp } = vi.hoisted(() => ({
  signUp: vi.fn<(previous: AuthFormState, formData: FormData) => Promise<AuthFormState>>(),
}));
vi.mock("./actions", () => ({ signUp }));

beforeEach(() => {
  signUp.mockReset();
});

const emailField = () => screen.getByRole("textbox", { name: "Adresse e-mail" });
const passwordField = () => screen.getByLabelText("Mot de passe");
const submit = () => screen.getByRole("button", { name: "Créer mon compte" });

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(emailField(), email);
  if (password) await user.type(passwordField(), password);
  await user.click(submit());
}

describe("Page d'inscription — contenus (CA10)", () => {
  it("CA10 — affiche le h1, l'introduction et les libellés exacts", () => {
    render(<SignUpPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Créer un compte" })).toBeInTheDocument();
    expect(screen.getByText("Un compte par propriétaire, pour toutes vos locations.")).toBeInTheDocument();
    expect(emailField()).toBeInTheDocument();
    expect(passwordField()).toBeInTheDocument();
  });

  it("CA10 — le champ e-mail : type email, autocomplete username, name email, obligatoire, vide, sans placeholder", () => {
    render(<SignUpPage />);

    const champ = emailField();
    expect(champ).toHaveAttribute("type", "email");
    expect(champ).toHaveAttribute("autocomplete", "username");
    expect(champ).toHaveAttribute("name", "email");
    expect(champ).toBeRequired();
    expect(champ).toHaveValue("");
    expect(champ).not.toHaveAttribute("placeholder");
  });

  it("CA10 — le champ mot de passe : type password, autocomplete new-password, name password, obligatoire, vide, sans placeholder", () => {
    render(<SignUpPage />);

    const champ = passwordField();
    expect(champ).toHaveAttribute("type", "password");
    expect(champ).toHaveAttribute("autocomplete", "new-password");
    expect(champ).toHaveAttribute("name", "password");
    expect(champ).toBeRequired();
    expect(champ).toHaveValue("");
    expect(champ).not.toHaveAttribute("placeholder");
  });

  it("CA10 — le texte d'aide est relié au champ mot de passe", () => {
    render(<SignUpPage />);

    expect(passwordField()).toHaveAccessibleDescription(
      "12 caractères au minimum. Conservez-le précieusement, un mot de passe oublié ne peut pas encore être réinitialisé.",
    );
  });

  it("CA10 — le bouton d'envoi s'appelle « Créer mon compte »", () => {
    render(<SignUpPage />);

    expect(submit()).toBeEnabled();
  });

  it("CA10 — le bas de carte contient le lien « Se connecter » vers /connexion", () => {
    render(<SignUpPage />);

    expect(screen.getByText(/Vous avez déjà un compte\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/connexion");
  });

  it("CA10 — aucun lien vers /inscription (cas « déjà là »)", () => {
    render(<SignUpPage />);

    const liens = screen.getAllByRole("link");
    expect(liens.map((lien) => lien.getAttribute("href"))).not.toContain("/inscription");
  });

  it("CA10 — état initial : aucun message d'erreur, aucun champ focalisé, mot de passe masqué", () => {
    render(<SignUpPage />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    expect(document.body).toHaveFocus();
    expect(passwordField()).toHaveAttribute("type", "password");
  });

  it("R10 — le formulaire n'a que deux champs de saisie et pas de case à cocher", () => {
    render(<SignUpPage />);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("R9 — le formulaire désactive la validation native du navigateur", () => {
    render(<SignUpPage />);

    expect(submit().closest("form")).toHaveAttribute("novalidate");
  });

  it("R30 — ordre de tabulation : e-mail, mot de passe, Afficher, envoi, lien", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.tab();
    expect(emailField()).toHaveFocus();
    await user.tab();
    expect(passwordField()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Afficher le mot de passe" })).toHaveFocus();
    await user.tab();
    expect(submit()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveFocus();
  });
});

describe("Formulaire d'inscription — envoi", () => {
  it("transmet l'adresse et le mot de passe saisis à l'action, tels quels", async () => {
    signUp.mockResolvedValue({ email: "x" });
    render(<SignUpPage />);

    // Pas d'espaces autour de l'adresse : jsdom les retire lui-même d'un champ
    // de type email, comme un navigateur. R4 est testé sur la fonction pure.
    await fillAndSubmit("Marie@Exemple.FR", " mot de passe ");

    expect(signUp).toHaveBeenCalledTimes(1);
    const formData = signUp.mock.calls[0][1];
    expect(formData.get("email")).toBe("Marie@Exemple.FR");
    expect(formData.get("password")).toBe(" mot de passe ");
  });

  it("R28 — pendant l'attente : « Création en cours », bouton désactivé, valeurs conservées", async () => {
    // Réponse retardée par le test. On la résout à la fin : une action qui ne
    // se termine jamais bloquerait la file des actions de React pour les tests suivants.
    let respond: (state: AuthFormState) => void = () => {};
    signUp.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    render(<SignUpPage />);

    await fillAndSubmit("marie@exemple.fr", "motdepasse-long");

    const bouton = await screen.findByRole("button", { name: "Création en cours" });
    expect(bouton).toBeDisabled();
    expect(emailField()).toHaveValue("marie@exemple.fr");
    expect(passwordField()).toHaveValue("motdepasse-long");

    await act(async () => respond({ email: "marie@exemple.fr" }));
  });
});

describe("Formulaire d'inscription — erreurs renvoyées par l'action", () => {
  it("CA12 — E1 et E4 : chaque message sous son champ, aria-invalid, focus sur l'e-mail", async () => {
    signUp.mockResolvedValue({
      email: "",
      emailError: ERROR_MESSAGES.E1,
      passwordError: ERROR_MESSAGES.E4,
    });
    render(<SignUpPage />);

    await fillAndSubmit("", "");

    expect(await screen.findByText(ERROR_MESSAGES.E1)).toBeInTheDocument();
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
    expect(emailField()).toHaveAccessibleDescription(ERROR_MESSAGES.E1);
    expect(passwordField()).toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).toHaveAccessibleDescription(
      new RegExp(`^${ERROR_MESSAGES.E4}`),
    );
    expect(emailField()).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("CA12 — E2 et E5 : l'adresse saisie est réaffichée, le mot de passe est vidé", async () => {
    signUp.mockResolvedValue({
      email: "marie@exemple",
      emailError: ERROR_MESSAGES.E2,
      passwordError: ERROR_MESSAGES.E5,
    });
    render(<SignUpPage />);

    await fillAndSubmit("marie@exemple", "a".repeat(11));

    expect(await screen.findByText(ERROR_MESSAGES.E2)).toBeInTheDocument();
    expect(screen.getByText(ERROR_MESSAGES.E5)).toBeInTheDocument();
    expect(emailField()).toHaveValue("marie@exemple");
    expect(passwordField()).toHaveValue("");
  });

  it("CA12 — seul E5 : le focus va sur le mot de passe, l'e-mail n'est pas en erreur", async () => {
    signUp.mockResolvedValue({
      email: "marie@exemple.fr",
      passwordError: ERROR_MESSAGES.E5,
    });
    render(<SignUpPage />);

    await fillAndSubmit("marie@exemple.fr", "a".repeat(11));

    expect(await screen.findByText(ERROR_MESSAGES.E5)).toBeInTheDocument();
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).toHaveFocus();
    expect(emailField()).toHaveValue("marie@exemple.fr");
  });

  it("R25 — l'erreur du mot de passe précède le texte d'aide dans sa description", async () => {
    signUp.mockResolvedValue({ email: "a@b.fr", passwordError: ERROR_MESSAGES.E6 });
    render(<SignUpPage />);

    await fillAndSubmit("a@b.fr", "x");

    await screen.findByText(ERROR_MESSAGES.E6);
    expect(passwordField()).toHaveAccessibleDescription(
      `${ERROR_MESSAGES.E6} 12 caractères au minimum. Conservez-le précieusement, un mot de passe oublié ne peut pas encore être réinitialisé.`,
    );
  });

  it("CA13 — E3 s'affiche sous l'adresse, qui est conservée, focus sur l'adresse", async () => {
    signUp.mockResolvedValue({ email: "Marie@Exemple.fr", emailError: ERROR_MESSAGES.E3 });
    render(<SignUpPage />);

    await fillAndSubmit("Marie@Exemple.fr", "motdepasse-long");

    expect(await screen.findByText(ERROR_MESSAGES.E3)).toBeInTheDocument();
    expect(emailField()).toHaveAccessibleDescription(ERROR_MESSAGES.E3);
    expect(emailField()).toHaveValue("Marie@Exemple.fr");
    expect(passwordField()).toHaveValue("");
    expect(emailField()).toHaveFocus();
  });

  it("R25 — une panne (E8) s'affiche dans un message de formulaire (alert) placé avant les champs, avec le focus", async () => {
    signUp.mockResolvedValue({ email: "marie@exemple.fr", formError: ERROR_MESSAGES.E8 });
    render(<SignUpPage />);

    await fillAndSubmit("marie@exemple.fr", "motdepasse-long");

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(ERROR_MESSAGES.E8);
    expect(alerte).toHaveFocus();
    expect(
      alerte.compareDocumentPosition(emailField()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(emailField()).toHaveValue("marie@exemple.fr");
    expect(passwordField()).toHaveValue("");
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("R25 — l'erreur disparaît à la soumission suivante si elle est corrigée", async () => {
    signUp
      .mockResolvedValueOnce({ email: "marie@exemple", emailError: ERROR_MESSAGES.E2 })
      .mockResolvedValueOnce({ email: "marie@exemple.fr" });
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(emailField(), "marie@exemple");
    await user.type(passwordField(), "motdepasse-long");
    await user.click(submit());
    await screen.findByText(ERROR_MESSAGES.E2);

    await user.type(emailField(), ".fr");
    await user.type(passwordField(), "motdepasse-long");
    await user.click(submit());

    expect(screen.queryByText(ERROR_MESSAGES.E2)).not.toBeInTheDocument();
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("R25 — pas de validation pendant la frappe", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(emailField(), "pas-une-adresse");
    await user.tab();

    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(signUp).not.toHaveBeenCalled();
  });
});
