import { describe, expect, it } from "vitest";

import {
  buildSignInPath,
  getSafeReturnPath,
  getSafeReturnPathFromPageUrl,
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

// getSafeReturnPathFromPageUrl lit l'en-tête Referer de la requête d'envoi du
// formulaire. Cet en-tête est écrit par le client : n'importe qui peut y mettre
// n'importe quoi. Une erreur ici est une redirection ouverte.
describe("getSafeReturnPathFromPageUrl", () => {
  const PAGE = "http://localhost:3100/connexion";
  const avec = (retour: string) => `${PAGE}?retour=${retour}`;

  describe("destinations acceptées (R14, CA9)", () => {
    it.each([
      ["CA9 — /tableau-de-bord", "%2Ftableau-de-bord", "/tableau-de-bord"],
      [
        "CA9 / parcours 4 — /tableau-de-bord?exemple=1, encodé comme le fait la redirection",
        "%2Ftableau-de-bord%3Fexemple%3D1",
        "/tableau-de-bord?exemple=1",
      ],
      ["CA9 — chemin avec ancre", "%2Flocations%2F12%23loyers", "/locations/12#loyers"],
      ["R14 — paramètres multiples conservés", "%2Fa%3Fx%3D1%26y%3D2", "/a?x=1&y=2"],
      ["R14 — valeur non encodée mais sûre", "/tableau-de-bord", "/tableau-de-bord"],
      ["R14 — /connexion en simple paramètre de la destination", "%2Fa%3Fretour%3D%2Fconnexion", "/a?retour=/connexion"],
    ])("%s", (_nom, retour, attendu) => {
      expect(getSafeReturnPathFromPageUrl(avec(retour))).toBe(attendu);
    });

    it("R23 / R14 — fait l'aller-retour avec buildSignInPath (chemin, paramètres encodés)", () => {
      const chemin = buildSignInPath("/tableau-de-bord", "?q=a%26b%3Dc&x=1");

      expect(getSafeReturnPathFromPageUrl(`http://localhost:3100${chemin}`)).toBe(
        "/tableau-de-bord?q=a%26b%3Dc&x=1",
      );
    });

    it("R14 — d'autres paramètres dans l'adresse de la page ne gênent pas", () => {
      expect(getSafeReturnPathFromPageUrl(`${PAGE}?x=1&retour=%2Fa&y=2`)).toBe("/a");
    });

    it("R14 — le fragment de la page de connexion n'est pas pris pour la destination", () => {
      expect(getSafeReturnPathFromPageUrl(`${PAGE}?retour=%2Fa#autre`)).toBe("/a");
    });

    it("R14 — un port ou un hôte différents n'empêchent pas la lecture d'une adresse légitime", () => {
      expect(
        getSafeReturnPathFromPageUrl("https://quittances.exemple.test:8443/connexion?retour=%2Fa"),
      ).toBe("/a");
    });
  });

  describe("repli sur /tableau-de-bord", () => {
    it.each([
      ["CA9 — pas de paramètre retour", PAGE],
      ["CA9 — retour vide", avec("")],
      ["R14 — retour sans valeur ni signe égal", `${PAGE}?retour`],
      ["R14 — seulement d'autres paramètres", `${PAGE}?autre=%2Fa`],
      ["R14 — le nom du paramètre est sensible à la casse", `${PAGE}?Retour=%2Fa`],
      ["R14 — destination relative sans barre initiale", avec("tableau-de-bord")],
      ["R14 — /connexion", avec("%2Fconnexion")],
      ["CA9 — /connexion?retour=/x", avec("%2Fconnexion%3Fretour%3D%2Fx")],
      ["CA9 — /inscription", avec("%2Finscription")],
      ["R14 — /Connexion (casse)", avec("%2FConnexion")],
      ["R14 — /connexion/ (barre finale)", avec("%2Fconnexion%2F")],
      ["R14 — /connexion avec ancre", avec("%2Fconnexion%23x")],
      ["R14 — /inscription avec paramètres", avec("%2Finscription%3Fx%3D1")],
    ])("%s", (_nom, adresse) => {
      expect(getSafeReturnPathFromPageUrl(adresse)).toBe(REPLI);
    });
  });

  describe("destinations hostiles refusées (redirection ouverte)", () => {
    it.each([
      ["CA9 — https absolue", "https%3A%2F%2Fexemple.test"],
      ["R14 — http absolue vers un chemin", "http%3A%2F%2Fexemple.test%2Ftableau-de-bord"],
      ["CA9 — //hôte", "%2F%2Fexemple.test"],
      ["R14 — ///hôte", "%2F%2F%2Fexemple.test"],
      ["CA9 — /\\hôte", "%2F%5Cexemple.test"],
      ["CA9 — \\/hôte", "%5C%2Fexemple.test"],
      ["R14 — \\\\hôte", "%5C%5Cexemple.test"],
      ["CA9 — schéma javascript", "javascript%3Aalert(1)"],
      ["R14 — schéma data", "data%3Atext%2Fhtml%2C%3Cscript%3E1%3C%2Fscript%3E"],
      ["R14 — tabulation entre deux barres", "%2F%09%2Fexemple.test"],
      ["R14 — saut de ligne entre deux barres", "%2F%0A%2Fexemple.test"],
      ["R14 — retour chariot entre deux barres", "%2F%0D%2Fexemple.test"],
      ["R14 — caractère nul", "%2Fa%00b"],
      ["R14 — caractère DEL", "%2Fa%7Fb"],
      ["R14 — barre oblique inverse dans le chemin", "%2Fa%5Cb"],
      ["R14 — espace initial", "%20%2Ftableau-de-bord"],
      ["R14 — double encodage de //hôte (une seule couche décodée)", "%252F%252Fexemple.test"],
      ["R14 — double encodage de https://", "https%253A%252F%252Fexemple.test"],
      ["R14 — double encodage de /\\hôte", "%252F%255Cexemple.test"],
    ])("%s", (_nom, retour) => {
      expect(getSafeReturnPathFromPageUrl(avec(retour))).toBe(REPLI);
    });

    it("R14 (précision après la recette de T4) — un %2F dans le chemin est refusé, même obtenu par un double encodage derrière une barre initiale", () => {
      // Après l'unique décodage du paramètre, la destination vaut /%2Fexemple.test :
      // son chemin contient %2F, que la règle refuse où que ce soit.
      expect(getSafeReturnPathFromPageUrl(avec("%2F%252Fexemple.test"))).toBe(REPLI);
    });
  });

  describe("paramètre répété (R14, précision après T4)", () => {
    it.each([
      ["deux valeurs sûres différentes", `${PAGE}?retour=%2Fa&retour=%2Fb`],
      ["deux valeurs sûres identiques", `${PAGE}?retour=%2Fa&retour=%2Fa`],
      ["première sûre, seconde hostile", `${PAGE}?retour=%2Fa&retour=%2F%2Fexemple.test`],
      ["première hostile, seconde sûre", `${PAGE}?retour=%2F%2Fexemple.test&retour=%2Fa`],
      ["première sûre, seconde vide", `${PAGE}?retour=%2Fa&retour=`],
      ["première vide, seconde sûre", `${PAGE}?retour=&retour=%2Fa`],
    ])("%s : repli sur /tableau-de-bord", (_nom, adresse) => {
      expect(getSafeReturnPathFromPageUrl(adresse)).toBe(REPLI);
    });
  });

  describe("en-tête absent, vide ou illisible", () => {
    it.each([
      ["CA9 — en-tête absent (null)", null],
      ["en-tête vide", ""],
      ["espaces seuls", "   "],
      ["texte qui n'est pas une adresse", "pas une adresse"],
      ["adresse relative (un Referer est toujours absolu)", "/connexion?retour=%2Fa"],
      ["adresse sans hôte", "http://"],
      ["hôte invalide", "http://exa mple.test/connexion?retour=%2Fa"],
      ["destination seule, sans la page", "/a"],
    ])("%s : repli sur /tableau-de-bord", (_nom, adresse) => {
      expect(getSafeReturnPathFromPageUrl(adresse)).toBe(REPLI);
    });
  });

  describe("autres pages que /connexion", () => {
    it.each([
      ["/", "http://localhost:3100/?retour=%2Fa"],
      ["/inscription", "http://localhost:3100/inscription?retour=%2Fa"],
      ["/tableau-de-bord", "http://localhost:3100/tableau-de-bord?retour=%2Fa"],
      ["/connexion/ (barre finale)", "http://localhost:3100/connexion/?retour=%2Fa"],
      ["/Connexion (casse)", "http://localhost:3100/Connexion?retour=%2Fa"],
      ["/connexion/aide", "http://localhost:3100/connexion/aide?retour=%2Fa"],
      ["/connexions", "http://localhost:3100/connexions?retour=%2Fa"],
      ["/connexion encodé (/%63onnexion)", "http://localhost:3100/%63onnexion?retour=%2Fa"],
      ["/x/connexion", "http://localhost:3100/x/connexion?retour=%2Fa"],
    ])("%s : repli sur /tableau-de-bord", (_nom, adresse) => {
      expect(getSafeReturnPathFromPageUrl(adresse)).toBe(REPLI);
    });
  });

  describe("adresse d'une autre origine", () => {
    // Le code ne compare pas l'origine du Referer à la nôtre. La spécification
    // (R14) définit la destination à partir du chemin /connexion et de la valeur
    // de `retour`, sans rien dire de l'origine. Ce qui compte pour la sécurité :
    // quelle que soit l'origine annoncée, le résultat est un chemin interne.
    it("R14 — une valeur sûre lue sur une autre origine reste un chemin interne", () => {
      const resultat = getSafeReturnPathFromPageUrl(
        "https://autre-site.test/connexion?retour=%2Ftableau-de-bord",
      );

      expect(resultat.startsWith("/")).toBe(true);
      expect(new URL(resultat, ORIGINE).origin).toBe(ORIGINE);
    });

    it("R14 — une valeur hostile lue sur une autre origine donne le repli", () => {
      expect(
        getSafeReturnPathFromPageUrl("https://autre-site.test/connexion?retour=%2F%2Fexemple.test"),
      ).toBe(REPLI);
    });

    it("R14 — l'hôte de l'adresse n'est jamais repris dans le résultat", () => {
      const resultat = getSafeReturnPathFromPageUrl(
        "https://autre-site.test/connexion?retour=%2Fa",
      );

      expect(resultat).not.toContain("autre-site");
    });

    it("R14 — des identifiants dans l'adresse (user@hôte) ne changent rien au chemin lu", () => {
      expect(
        getSafeReturnPathFromPageUrl("http://localhost:3100@autre-site.test/connexion?retour=%2Fa"),
      ).toBe("/a");
    });
  });

  describe("propriété — le résultat est toujours un chemin interne (R14)", () => {
    const retours = [
      "", "/", "%2F", "%2F%2Fexemple.test", "%5C%5Cexemple.test", "%2F%5Cexemple.test",
      "https%3A%2F%2Fexemple.test", "javascript%3Aalert(1)", "%2F%09%2Fexemple.test",
      "%2F%0A%2Fexemple.test", "%2F%00", "%252F%252Fexemple.test", "%2F%252Fexemple.test",
      "%2F%2540exemple.test", "%2F%40exemple.test", "%2F%3F%40exemple.test", "%2F.%2F%2Fexemple.test",
      "%2F..%2F%2Fexemple.test", "%2F%20%2Fexemple.test", "%2F%E2%80%8B%2Fexemple.test",
      "%EF%BC%8F%EF%BC%8Fexemple.test", "%2Ftableau-de-bord%3Fexemple%3D1", "%2Flocations%2F12%23loyers",
      "%2Fconnexion", "%2Finscription", "%zz", "%2F%zz", "%E0%A4%A", "tableau-de-bord",
    ];
    const bases = [
      "http://localhost:3100/connexion",
      "https://autre-site.test/connexion",
      "http://localhost:3100/connexion/",
      "http://localhost:3100/",
    ];
    const adresses = bases.flatMap((base) => [
      ...retours.map((retour) => `${base}?retour=${retour}`),
      ...retours.map((retour) => `${base}?retour=${retour}&retour=%2Fa`),
    ]);

    it.each(adresses)("%s", (adresse) => {
      const resultat = getSafeReturnPathFromPageUrl(adresse);

      expect(resultat.startsWith("/")).toBe(true);
      expect(resultat.startsWith("//")).toBe(false);
      expect(resultat.startsWith("/\\")).toBe(false);
      expect(resultat).not.toMatch(/[\u0000-\u001F\u007F\\]/);
      expect(new URL(resultat, ORIGINE).origin).toBe(ORIGINE);
      expect(["/connexion", "/inscription"]).not.toContain(new URL(resultat, ORIGINE).pathname);
    });
  });
});

// Précision de R14 après la recette de T4 : redirection ouverte par un chemin
// non canonique (« /.//exemple.test » devient « //exemple.test » dans le routeur
// de Next). La propriété vérifiée porte sur ce que le navigateur suivra.
describe("R14 (précision après la recette de T4) — forme canonique et destination reconstruite", () => {
  // Ce que le navigateur suivra : la destination, relue par un lecteur d'adresse,
  // ne doit plus changer, rester sur l'origine et ne jamais redevenir « //hôte ».
  function expectNavigable(resultat: string) {
    expect(getSafeReturnPath(resultat)).toBe(resultat);
    const url = new URL(resultat, ORIGINE);
    expect(url.origin).toBe(ORIGINE);
    expect(url.pathname + url.search + url.hash).toBe(resultat);
    expect(url.pathname.startsWith("//")).toBe(false);
    expect(url.pathname).not.toContain("//");
    expect(url.pathname).not.toContain("\\");
  }

  const RECETTE = [
    "/.//exemple.test",
    "/a/..//exemple.test",
    "/%2e//exemple.test",
    "/%2e%2e//exemple.test",
  ];

  const JETONS = [
    "//", "\\", ".", "..", "%2e", "%2E", "%2f", "%2F", "%5c", "%5C", "%252e", "%252E",
    "%252f", "%252F", "%255c", "%25252e", "%zz",
  ];
  // En tête, au milieu et en fin de chemin, comme segment entier.
  const INTERDITES = JETONS.flatMap((jeton) => [
    [`${jeton} en tête`, `/${jeton}/a`],
    [`${jeton} au milieu`, `/a/${jeton}/b`],
    [`${jeton} en fin`, `/a/${jeton}`],
  ]);
  // Collées à d'autres caractères (hors « . » et « .. », légitimes dans « a.b »).
  const COLLEES = JETONS.filter((jeton) => jeton !== "." && jeton !== "..").flatMap((jeton) => [
    [`${jeton} collé au début d'un segment`, `/${jeton}a`],
    [`${jeton} collé au milieu d'un segment`, `/a${jeton}b`],
    [`${jeton} collé à la fin d'un segment`, `/a${jeton}`],
  ]);

  const HOSTILES = [
    ...RECETTE,
    ...INTERDITES.map(([, valeur]) => valeur),
    ...COLLEES.map(([, valeur]) => valeur),
    "//exemple.test", "/\\exemple.test", "https://exemple.test", "javascript:alert(1)",
    "/./", "/../", "/./exemple.test", "/../exemple.test", "/a/..//", "/a/../", "/.//", "/..//exemple.test",
    "/%2e", "/%2e%2e", "/%2e%2e/", "/%2E%2E//exemple.test", "/%2f/exemple.test", "/%2F%2Fexemple.test",
    "/%252e//exemple.test", "/%252f%252fexemple.test", "/%25252e%25252e//exemple.test",
    `/${"a/".repeat(900)}..//exemple.test`,
    `/${"a".repeat(2000)}`,
    "/\t/exemple.test", "/\n/exemple.test", "／／exemple.test",
  ];

  describe("les quatre valeurs de la recette", () => {
    it.each(RECETTE)("%s : repli sur /tableau-de-bord", (valeur) => {
      expect(getSafeReturnPath(valeur)).toBe(REPLI);
    });

    it.each(RECETTE)("%s : repli sur /tableau-de-bord, lu dans le Referer", (valeur) => {
      const adresse = `http://localhost:3100/connexion?retour=${encodeURIComponent(valeur)}`;

      expect(getSafeReturnPathFromPageUrl(adresse)).toBe(REPLI);
    });
  });

  describe("formes interdites dans le chemin", () => {
    it.each(INTERDITES)("%s : %s est refusé", (_nom, valeur) => {
      expect(getSafeReturnPath(valeur)).toBe(REPLI);
      expect(isSafeReturnPath(valeur)).toBe(false);
    });

    it.each(COLLEES)("%s : %s est refusé", (_nom, valeur) => {
      expect(getSafeReturnPath(valeur)).toBe(REPLI);
    });

    it.each(INTERDITES)("%s : %s est refusé, lu dans le Referer", (_nom, valeur) => {
      const adresse = `http://localhost:3100/connexion?retour=${encodeURIComponent(valeur)}`;

      expect(getSafeReturnPathFromPageUrl(adresse)).toBe(REPLI);
    });
  });

  describe("limite entre le chemin et les paramètres ou l'ancre", () => {
    it.each(["/a?x=//b", "/a?x=../c", "/a#//b", "/a#../b", "/a?x=https://exemple.test/y", "/a?x=%2e%2e%2f"])(
      "%s : acceptée, renvoyée à l'identique (la règle ne porte que sur le chemin)",
      (valeur) => {
        expect(getSafeReturnPath(valeur)).toBe(valeur);
      },
    );

    it.each(["/a//b?x=1", "/a/../b#x", "/a/./b?x=1", "/a%2fb?x=1", "/a/..?x=1", "/a//?x=1"])(
      "%s : refusée (la forme interdite est dans le chemin)",
      (valeur) => {
        expect(getSafeReturnPath(valeur)).toBe(REPLI);
      },
    );

    it("lue dans le Referer, une requête avec // est conservée", () => {
      const adresse = `http://localhost:3100/connexion?retour=${encodeURIComponent("/a?x=//b")}`;

      expect(getSafeReturnPathFromPageUrl(adresse)).toBe("/a?x=//b");
    });
  });

  describe("destination reconstruite, jamais la chaîne reçue", () => {
    it("un caractère non ASCII est encodé par l'analyse : /é donne /%C3%A9", () => {
      expect(getSafeReturnPath("/é")).toBe("/%C3%A9");
    });

    it("un « ? » final disparaît : /a? donne /a", () => {
      expect(getSafeReturnPath("/a?")).toBe("/a");
    });

    it("une barre pleine chasse en tête reste refusée", () => {
      expect(getSafeReturnPath("／／exemple.test")).toBe(REPLI);
      expect(getSafeReturnPath("／tableau-de-bord")).toBe(REPLI);
    });

    it("la reconstruction vaut aussi dans le Referer : /é donne /%C3%A9", () => {
      const adresse = `http://localhost:3100/connexion?retour=${encodeURIComponent("/é")}`;

      expect(getSafeReturnPathFromPageUrl(adresse)).toBe("/%C3%A9");
    });

    it("une destination déjà canonique est renvoyée à l'identique, ancre et paramètres compris", () => {
      expect(getSafeReturnPath("/locations/12?x=1&y=%C3%A9#loyers")).toBe(
        "/locations/12?x=1&y=%C3%A9#loyers",
      );
    });
  });

  describe("longueur maximale", () => {
    it("2000 caractères : acceptés", () => {
      const valeur = `/${"a".repeat(1999)}`;

      expect(valeur).toHaveLength(2000);
      expect(getSafeReturnPath(valeur)).toBe(valeur);
    });

    it("2001 caractères : refusés", () => {
      const valeur = `/${"a".repeat(2000)}`;

      expect(valeur).toHaveLength(2001);
      expect(getSafeReturnPath(valeur)).toBe(REPLI);
    });

    it("2001 caractères : refusés même si l'excédent est dans les paramètres", () => {
      expect(getSafeReturnPath(`/a?x=${"b".repeat(1996)}`)).toBe(REPLI);
    });
  });

  describe("point-virgule : choix figé", () => {
    // Aucun lecteur d'adresse ne traite « ; » comme un séparateur de segment :
    // ces valeurs restent internes. Le choix est de les accepter telles quelles.
    it.each(["/;/x", "/..;/x", "/a;b/c", "/;"])("%s : acceptée, renvoyée à l'identique", (valeur) => {
      expect(getSafeReturnPath(valeur)).toBe(valeur);
    });

    it.each(["/;/x", "/..;/x", "/;//x", "/..;//x"])("%s : la destination renvoyée est navigable", (valeur) => {
      expectNavigable(getSafeReturnPath(valeur));
    });

    it.each(["/;//exemple.test", "/..;//exemple.test"])("%s : refusée (// dans le chemin)", (valeur) => {
      expect(getSafeReturnPath(valeur)).toBe(REPLI);
    });
  });

  describe("propriété — ce que le navigateur suivra", () => {
    it.each(HOSTILES)("getSafeReturnPath(%j) est idempotent, sur l'origine et canonique", (valeur) => {
      expectNavigable(getSafeReturnPath(valeur));
    });

    it.each(HOSTILES)("getSafeReturnPathFromPageUrl(Referer portant %j) est navigable", (valeur) => {
      const adresse = `http://localhost:3100/connexion?retour=${encodeURIComponent(valeur)}`;

      expectNavigable(getSafeReturnPathFromPageUrl(adresse));
    });

    it.each(HOSTILES)("%j : le brut non encodé dans le Referer est navigable aussi", (valeur) => {
      expectNavigable(getSafeReturnPathFromPageUrl(`http://localhost:3100/connexion?retour=${valeur}`));
    });

    it.each([
      "/tableau-de-bord", "/tableau-de-bord?exemple=1", "/locations/12#loyers", "/", "/a/b?x=1&y=2#fin",
      "/a?x=//b", "/é", "/a?", "/;/x", "/..;/x",
    ])("%j : une destination légitime est navigable", (valeur) => {
      expectNavigable(getSafeReturnPath(valeur));
    });
  });
});
