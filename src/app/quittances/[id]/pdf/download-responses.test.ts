import { describe, expect, it } from "vitest";

import {
  buildStandaloneDocument,
  methodNotAllowedResponse,
  notFoundResponse,
  pdfResponse,
  signInRedirectResponse,
  unavailableResponse,
} from "./download-responses";

// Un « PDF » de test : seuls ses octets comptent, la réponse ne les lit pas.
const OCTETS = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0xff, 0x80]);
// Nom de fichier de l'exemple de R32 : identifiant 3f9a1c2e-…, mois 2026-10.
const NOM_FICHIER = "quittance-2026-10-3f9a1c2e.pdf";

function document(texteHtml: string): Document {
  return new DOMParser().parseFromString(texteHtml, "text/html");
}

describe("pdfResponse — réponse réussie (R32, CA30)", () => {
  it("R32 — code 200", () => {
    expect(pdfResponse(OCTETS, NOM_FICHIER).status).toBe(200);
  });

  it("R32 — Content-Type: application/pdf", () => {
    expect(pdfResponse(OCTETS, NOM_FICHIER).headers.get("Content-Type")).toBe(
      "application/pdf",
    );
  });

  it("R32 — Content-Disposition: attachment avec le nom exact, entre guillemets", () => {
    const disposition = pdfResponse(OCTETS, NOM_FICHIER).headers.get(
      "Content-Disposition",
    );

    expect(disposition).toBe(
      'attachment; filename="quittance-2026-10-3f9a1c2e.pdf"',
    );
  });

  it("R32 — le nom de fichier n'est fait que de a à z, de chiffres, de tirets et d'un point", () => {
    const disposition = pdfResponse(OCTETS, NOM_FICHIER).headers.get(
      "Content-Disposition",
    )!;

    const nom = /filename="([^"]*)"/.exec(disposition)![1];
    expect(nom).toMatch(/^[a-z0-9.-]+$/);
    expect(nom).toMatch(/^quittance-\d{4}-\d{2}-[0-9a-f]{8}\.pdf$/);
  });

  it("R32 — Cache-Control: private, no-store", () => {
    expect(pdfResponse(OCTETS, NOM_FICHIER).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });

  it("R32 — X-Content-Type-Options: nosniff", () => {
    expect(
      pdfResponse(OCTETS, NOM_FICHIER).headers.get("X-Content-Type-Options"),
    ).toBe("nosniff");
  });

  it("R32 — le corps est exactement les octets fournis", async () => {
    const corps = new Uint8Array(await pdfResponse(OCTETS, NOM_FICHIER).arrayBuffer());

    expect(Array.from(corps)).toEqual(Array.from(OCTETS));
  });

  it("R32 — ne renvoie pas de redirection ni d'en-tête Location", () => {
    expect(pdfResponse(OCTETS, NOM_FICHIER).headers.get("Location")).toBeNull();
  });

  it("R32 — l'objet de réponse est indépendant du tableau fourni (le modifier ensuite ne change pas le corps)", async () => {
    const source = new Uint8Array(OCTETS);
    const reponse = pdfResponse(source, NOM_FICHIER);
    source.fill(0);

    const corps = new Uint8Array(await reponse.arrayBuffer());
    expect(Array.from(corps)).toEqual(Array.from(OCTETS));
  });
});

describe("signInRedirectResponse — sans session (R33, CA31)", () => {
  it("R33 — code 307", () => {
    expect(signInRedirectResponse().status).toBe(307);
  });

  it("R33 — Location: /connexion, sans aucun paramètre", () => {
    const location = signInRedirectResponse().headers.get("Location");

    expect(location).toBe("/connexion");
    expect(location).not.toContain("?");
    expect(location).not.toContain("retour");
  });

  it("R33 — aucun octet de corps", async () => {
    const reponse = signInRedirectResponse();

    expect(await reponse.text()).toBe("");
  });

  it("R33 — no-store, ni application/pdf ni Content-Disposition", () => {
    const { headers } = signInRedirectResponse();

    expect(headers.get("Cache-Control")).toContain("no-store");
    expect(headers.get("Content-Type")).not.toBe("application/pdf");
    expect(headers.get("Content-Disposition")).toBeNull();
  });
});

describe.each([
  ["404 — notFoundResponse", () => notFoundResponse(), 404],
  ["503 — unavailableResponse(503)", () => unavailableResponse(503), 503],
  ["500 — unavailableResponse(500)", () => unavailableResponse(500), 500],
] as const)("%s (R33)", (_nom, creer, code) => {
  it(`R33 — code ${code}`, () => {
    expect(creer().status).toBe(code);
  });

  it("R33 — type HTML, jamais application/pdf", () => {
    const type = creer().headers.get("Content-Type");

    expect(type).toMatch(/^text\/html/);
    expect(type).not.toContain("application/pdf");
  });

  it("R33 — Cache-Control contenant no-store", () => {
    expect(creer().headers.get("Cache-Control")).toContain("no-store");
  });

  it("R33 — aucun en-tête Content-Disposition", () => {
    expect(creer().headers.get("Content-Disposition")).toBeNull();
  });

  it("R32 — X-Content-Type-Options: nosniff", () => {
    expect(creer().headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("R33 — document HTML en français, avec un titre et un seul h1", async () => {
    const doc = document(await creer().text());

    expect(doc.documentElement.lang).toBe("fr");
    expect(doc.title.trim()).not.toBe("");
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
  });

  it("R33 — aucun message technique ni donnée de quittance dans le corps", async () => {
    const texte = await creer().text();

    expect(texte).not.toMatch(/stack|Error|exception|at \w+\s*\(|SELECT|postgres/i);
    expect(texte).not.toMatch(/Marie Durand|Paul Martin|rue des Lilas|\d{5} (Paris|Lyon)/);
  });
});

describe("notFoundResponse — textes de « Quittance introuvable » (R22, R33, CA32)", () => {
  it("R33 — titre, h1, texte et lien de retour de « Contenus »", async () => {
    const doc = document(await notFoundResponse().text());

    expect(doc.title).toBe("Quittance introuvable — Quittances");
    expect(doc.querySelector("h1")?.textContent).toBe("Quittance introuvable");
    expect(doc.body.textContent).toContain(
      "Cette quittance n'existe pas ou a été supprimée.",
    );
    const lien = doc.querySelector("a");
    expect(lien?.textContent).toBe("Retour au tableau de bord");
    expect(lien?.getAttribute("href")).toBe("/tableau-de-bord");
  });

  it("R22 — deux appels donnent le même corps (la réponse ne dépend d'aucune demande)", async () => {
    const premier = await notFoundResponse().text();
    const second = await notFoundResponse().text();

    expect(second).toBe(premier);
  });
});

describe("unavailableResponse — titre et phrase de l'écran de panne (R33)", () => {
  it.each([500, 503] as const)("R33 — %i : h1 et phrase de la spécification 02", async (code) => {
    const doc = document(await unavailableResponse(code).text());

    expect(doc.querySelector("h1")?.textContent).toBe(
      "Service momentanément indisponible",
    );
    expect(doc.body.textContent).toContain(
      "Cette page ne peut pas être affichée pour le moment.",
    );
  });

  it("R33 — 500 et 503 portent le même document", async () => {
    const corps500 = await unavailableResponse(500).text();
    const corps503 = await unavailableResponse(503).text();

    expect(corps500).toBe(corps503);
  });

  it("R33 — n'affiche pas les textes de « Quittance introuvable »", async () => {
    const texte = await unavailableResponse(503).text();

    expect(texte).not.toContain("Quittance introuvable");
  });
});

describe("methodNotAllowedResponse — autre méthode que GET et HEAD (R33, CA31)", () => {
  it("R33 — code 405", () => {
    expect(methodNotAllowedResponse().status).toBe(405);
  });

  it("R33 — Allow: GET, HEAD", () => {
    expect(methodNotAllowedResponse().headers.get("Allow")).toBe("GET, HEAD");
  });

  it("R33 — no-store, ni application/pdf ni Content-Disposition", () => {
    const { headers } = methodNotAllowedResponse();

    expect(headers.get("Cache-Control")).toContain("no-store");
    expect(headers.get("Content-Type")).not.toBe("application/pdf");
    expect(headers.get("Content-Disposition")).toBeNull();
  });

  it("R33 — corps vide", async () => {
    expect(await methodNotAllowedResponse().text()).toBe("");
  });
});

describe("buildStandaloneDocument — document HTML autonome (R33)", () => {
  const BASE = { title: "Titre", heading: "Un titre", text: "Un texte." };

  it("R33 — structure : doctype, lang=fr, titre, h1, paragraphe, lien", () => {
    const html = buildStandaloneDocument({
      ...BASE,
      link: { href: "/tableau-de-bord", label: "Retour" },
    });
    const doc = document(html);

    expect(html.toLowerCase().startsWith("<!doctype html>")).toBe(true);
    expect(doc.documentElement.lang).toBe("fr");
    expect(doc.title).toBe("Titre");
    expect(doc.querySelector("h1")?.textContent).toBe("Un titre");
    expect(doc.querySelector("p")?.textContent).toBe("Un texte.");
    expect(doc.querySelector("a")?.getAttribute("href")).toBe("/tableau-de-bord");
  });

  it("R33 — sans lien, aucun lien n'est rendu", () => {
    expect(document(buildStandaloneDocument(BASE)).querySelector("a")).toBeNull();
  });

  it("R33 — déclare l'encodage UTF-8 (les accents du français)", () => {
    const meta = document(buildStandaloneDocument(BASE)).querySelector("meta[charset]");

    expect(meta?.getAttribute("charset")?.toLowerCase()).toBe("utf-8");
  });

  it("R33 — échappe <script> dans le titre, le h1, le texte et le libellé du lien", () => {
    const piege = "<script>alert(1)</script>";
    const html = buildStandaloneDocument({
      title: piege,
      heading: piege,
      text: piege,
      link: { href: "/x", label: piege },
    });
    const doc = document(html);

    expect(doc.querySelector("script")).toBeNull();
    expect(doc.title).toBe(piege);
    expect(doc.querySelector("h1")?.textContent).toBe(piege);
    expect(doc.querySelector("p")?.textContent).toBe(piege);
    expect(doc.querySelector("a")?.textContent).toBe(piege);
  });

  it("R33 — échappe l'esperluette : « Q&A &amp; &lt; » est affiché tel quel", () => {
    const texte = "Q&A &amp; &lt;";
    const doc = document(buildStandaloneDocument({ ...BASE, text: texte }));

    expect(doc.querySelector("p")?.textContent).toBe(texte);
  });

  it("R33 — une adresse de lien avec guillemet ne peut pas ajouter d'attribut", () => {
    const html = buildStandaloneDocument({
      ...BASE,
      link: { href: '/x" onclick="alert(1)', label: "Lien" },
    });
    const lien = document(html).querySelector("a")!;

    expect(lien.getAttribute("onclick")).toBeNull();
    expect(lien.getAttribute("href")).toBe('/x" onclick="alert(1)');
  });
});
