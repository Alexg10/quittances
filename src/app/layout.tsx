import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Seules les graisses de la spécification (R3) sont chargées.
const display = Plus_Jakarta_Sans({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["700"],
});

const body = DM_Sans({
  variable: "--font-body-face",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Quittances — quittances de loyer et relances par e-mail",
  description:
    "Un e-mail le jour de l'échéance, vous confirmez le loyer reçu, et la quittance PDF ou la relance part chez votre locataire.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
