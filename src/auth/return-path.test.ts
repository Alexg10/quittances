import { describe, expect, it } from "vitest";

import {
  buildSignInPath,
  getSafeReturnPath,
  isSafeReturnPath,
  toSearchString,
} from "./return-path";

const REPLI = "/tableau-de-bord";
const ORIGINE = "http://origine.test";

describe("getSafeReturnPath — valeurs acceptées", () => {
  it.each([
    ["CA9 — le tableau de bord", "/tableau-de-bord"],
    ["CA9 — avec un paramètre", "/tableau-de-bord?exemple=1"],
    ["CA9 — avec une ancre", "/locations/12#loyers"],
    ["R14 — la racine", "/"],
    ["R14 — paramètres multiples et ancre conservés", "/a/b?x=1&y=2&x=3#fin"],
    ["R14 — paramètre encodé conservé tel quel", "/a?q=%C3%A9%20t%C3%A9"],
    ["R14 — un chemin voisin de /connexion n'est pas /connexion", "/connexions"],
    ["R14 — un sous-chemin de /connexion n'est pas /connexion", "/connexion/aide"],
    ["R14 — /connexion en simple paramètre", "/tableau-de-bord?retour=/connexion"],
  ])("%s : %s est retenue à l'identique", (_nom, valeur) => {
    expect(getSafeReturnPath(valeur)).toBe(valeur);
  });
});

describe("getSafeReturnPath — valeurs refusées (repli sur /tableau-de-bord)", () => {
  it.each([
    ["CA9 — vide", ""],
    ["CA9 — URL absolue https", "https://exemple.test"],
    ["CA9 — //hôte", "//exemple.test"],
    ["CA9 — /\\hôte", "/\\exemple.test"],
    ["CA9 — \\/hôte", "\\/exemple.test"],
    ["CA9 — schéma javascript", "javascript:alert(1)"],
    ["CA9 — sans barre initiale", "tableau-de-bord"],
    ["CA9 — /connexion", "/connexion"],
    ["CA9 — /connexion avec retour", "/connexion?retour=/x"],
    ["CA9 — /inscription", "/inscription"],
    ["R14 — http absolue", "http://exemple.test/tableau-de-bord"],
    ["R14 — schéma data", "data:text/html,<script>1</script>"],
    ["R14 — schéma sans barres", "mailto:a@exemple.test"],
    ["R14 — trois barres", "///exemple.test"],
    ["R14 — barre oblique inverse en milieu de chemin", "/a\\b"],
    ["R14 — deux barres obliques inverses", "\\\\exemple.test"],
    ["R14 — encodage %2F%2F sans barre initiale", "%2F%2Fexemple.test"],
    ["R14 — encodage %5C sans barre initiale", "%5Cexemple.test"],
    ["R14 — tabulation entre deux barres", "/\t/exemple.test"],
    ["R14 — saut de ligne entre deux barres", "/\n/exemple.test"],
    ["R14 — retour chariot entre deux barres", "/\r/exemple.test"],
    ["R14 — tabulation dans le chemin", "/tableau\t-de-bord"],
    ["R14 — caractère nul", "/a\u0000b"],
    ["R14 — caractère DEL (127)", "/a\u007Fb"],
    ["R14 — caractère de contrôle dans la requête", "/a?x=\u0001"],
    ["R14 — caractère de contrôle dans l'ancre", "/a#\u001Fb"],
    ["R14 — /connexion avec ancre", "/connexion#x"],
    ["R14 — /inscription avec paramètres", "/inscription?x=1"],
    ["R14 — espace avant la barre", " /tableau-de-bord"],
    ["R14 — barres pleine chasse (non ASCII)", "／／exemple.test"],
  ])("%s : %j", (_nom, valeur) => {
    expect(getSafeReturnPath(valeur)).toBe(REPLI);
  });

  it.each([
    ["CA9 — absente (undefined)", undefined],
    ["CA9 — null", null],
  ])("%s", (_nom, valeur) => {
    expect(getSafeReturnPath(valeur)).toBe(REPLI);
  });

  it("R14 — un tableau de valeurs (?retour=a&retour=b) ne produit pas de redirection ouverte", () => {
    // Next fournit un tableau quand le paramètre est répété. Le type du
    // paramètre est une chaîne, mais le serveur reçoit ce que le client envoie.
    const tableau = ["/tableau-de-bord", "//exemple.test"] as unknown as string;
    expect(getSafeReturnPath(tableau)).toBe(REPLI);
  });
});

describe("getSafeReturnPath — variantes de casse, barre finale, encodage de /connexion et /inscription", () => {
  // La spécification dit « son chemin n'est ni /connexion ni /inscription ». Elle
  // ne dit rien de la casse, de la barre finale ni de l'encodage : ces cas
  // relèvent de la prudence (une destination qui désigne la page de connexion
  // sous un autre nom ferait tourner en rond), pas d'une ligne précise.
  it.each([
    ["barre finale", "/connexion/"],
    ["casse", "/Connexion"],
    ["casse, majuscules", "/INSCRIPTION"],
    ["lettre encodée", "/%63onnexion"],
    ["barre finale et paramètres", "/inscription/?x=1"],
  ])("refuse /connexion ou /inscription avec %s : %s", (_nom, valeur) => {
    expect(getSafeReturnPath(valeur)).toBe(REPLI);
  });
});

describe("getSafeReturnPath — propriété : jamais hors de l'origine", () => {
  const adverses = [
    "//exemple.test",
    "/\\exemple.test",
    "\\/exemple.test",
    "/\t/exemple.test",
    "/\n/exemple.test",
    "/\r\n/exemple.test",
    "///exemple.test",
    "https://exemple.test",
    "javascript:alert(1)",
    "/%2F%2Fexemple.test",
    "/%5Cexemple.test",
    "/%09/exemple.test",
    "/.//exemple.test",
    "/..//exemple.test",
    "/a/..//exemple.test",
    "/ /exemple.test",
    "/​/exemple.test",
    "/@exemple.test",
    "/?@exemple.test",
    "/#//exemple.test",
  ];

  it.each(adverses)(
    "R14 — %j mène toujours à l'origine de l'application, ou au repli",
    (valeur) => {
      const resultat = getSafeReturnPath(valeur);
      // Comme le fera le navigateur : la destination est résolue contre l'origine.
      expect(new URL(resultat, ORIGINE).origin).toBe(ORIGINE);
    },
  );
});

describe("isSafeReturnPath", () => {
  it("R14 — accepte un chemin interne avec paramètres et ancre", () => {
    expect(isSafeReturnPath("/locations/12?x=1#loyers")).toBe(true);
  });

  it.each(["//exemple.test", "/\\x", "/connexion", "/inscription", "x", "/\t/x"])(
    "R14 — refuse %j",
    (valeur) => {
      expect(isSafeReturnPath(valeur)).toBe(false);
    },
  );

  it("R14 — refuse la chaîne vide", () => {
    expect(isSafeReturnPath("")).toBe(false);
  });
});

describe("buildSignInPath", () => {
  it("R23 — encode le chemin et la requête (parcours 4)", () => {
    expect(buildSignInPath("/tableau-de-bord", "?exemple=1")).toBe(
      "/connexion?retour=%2Ftableau-de-bord%3Fexemple%3D1",
    );
  });

  it("R23 — sans paramètre : /connexion?retour=%2Ftableau-de-bord", () => {
    expect(buildSignInPath("/tableau-de-bord")).toBe(
      "/connexion?retour=%2Ftableau-de-bord",
    );
  });

  it("R23 — une requête vide équivaut à l'absence de requête", () => {
    expect(buildSignInPath("/tableau-de-bord", "")).toBe(
      buildSignInPath("/tableau-de-bord"),
    );
  });

  it("R23 — un « & » de la requête reste dans la valeur de retour, il ne crée pas un second paramètre", () => {
    const adresse = buildSignInPath("/tableau-de-bord", "?a=1&b=2");
    const params = new URL(adresse, ORIGINE).searchParams;

    expect([...params.keys()]).toEqual(["retour"]);
    expect(params.get("retour")).toBe("/tableau-de-bord?a=1&b=2");
  });

  it("R23 — une valeur de requête encodée traverse l'aller-retour sans être décodée deux fois", () => {
    const demande = "/tableau-de-bord?q=%C3%A9%26x";
    const retour = new URL(buildSignInPath(demande), ORIGINE).searchParams.get(
      "retour",
    );

    expect(retour).toBe(demande);
  });

  it("R14 et R23 — la destination construite pour une page sûre est reprise à l'identique par getSafeReturnPath", () => {
    const retour = new URL(
      buildSignInPath("/tableau-de-bord", "?exemple=1"),
      ORIGINE,
    ).searchParams.get("retour");

    expect(getSafeReturnPath(retour)).toBe("/tableau-de-bord?exemple=1");
  });

  it("R22 — si la page demandée est /connexion, la destination construite est refusée au retour (pas de boucle)", () => {
    const retour = new URL(buildSignInPath("/connexion"), ORIGINE).searchParams.get(
      "retour",
    );

    expect(getSafeReturnPath(retour)).toBe(REPLI);
  });
});

describe("toSearchString", () => {
  it("CA17 — aucun paramètre : chaîne vide", () => {
    expect(toSearchString({})).toBe("");
  });

  it("CA17 — un paramètre", () => {
    expect(toSearchString({ exemple: "1" })).toBe("?exemple=1");
  });

  it("R23 — plusieurs paramètres, dans l'ordre", () => {
    expect(toSearchString({ a: "1", b: "2" })).toBe("?a=1&b=2");
  });

  it("R23 — un paramètre répété (tableau) est conservé en entier", () => {
    expect(toSearchString({ a: ["1", "2"] })).toBe("?a=1&a=2");
  });

  it("R23 — un paramètre absent (undefined) est ignoré", () => {
    expect(toSearchString({ a: undefined, b: "2" })).toBe("?b=2");
  });

  it("R23 — seuls des paramètres absents donnent une chaîne vide", () => {
    expect(toSearchString({ a: undefined })).toBe("");
  });

  it("R23 — un tableau vide n'ajoute rien", () => {
    expect(toSearchString({ a: [] })).toBe("");
  });

  it("R23 — une valeur vide est conservée (?a=)", () => {
    const params = new URLSearchParams(toSearchString({ a: "" }));

    expect(params.getAll("a")).toEqual([""]);
  });

  it("R23 — les caractères spéciaux sont encodés et se relisent à l'identique", () => {
    const valeur = "é & = # ? / +";
    const params = new URLSearchParams(toSearchString({ q: valeur }));

    expect(params.getAll("q")).toEqual([valeur]);
  });

  it("R23 — la chaîne obtenue commence par « ? » et n'a pas de « # » brut", () => {
    const resultat = toSearchString({ q: "a#b" });

    expect(resultat.startsWith("?")).toBe(true);
    expect(resultat).not.toContain("#");
  });
});
