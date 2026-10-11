import { describe, expect, it } from "vitest";

import { readTextField } from "./form-state";

describe("readTextField", () => {
  it("renvoie la valeur du champ telle quelle, sans rognage", () => {
    const formData = new FormData();
    formData.append("password", "  secret  ");

    expect(readTextField(formData, "password")).toBe("  secret  ");
  });

  it("renvoie une chaîne vide si le champ est absent", () => {
    expect(readTextField(new FormData(), "email")).toBe("");
  });

  it("renvoie une chaîne vide si le champ est envoyé plusieurs fois", () => {
    const formData = new FormData();
    formData.append("email", "a@exemple.fr");
    formData.append("email", "b@exemple.fr");

    expect(readTextField(formData, "email")).toBe("");
  });

  it("renvoie une chaîne vide si le champ est envoyé comme fichier", () => {
    const formData = new FormData();
    formData.append("email", new File(["a@exemple.fr"], "adresse.txt"));

    expect(readTextField(formData, "email")).toBe("");
  });

  it("ne lit que le champ demandé", () => {
    const formData = new FormData();
    formData.append("email", "a@exemple.fr");
    formData.append("password", "x");

    expect(readTextField(formData, "email")).toBe("a@exemple.fr");
  });
});
