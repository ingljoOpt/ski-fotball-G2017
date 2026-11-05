import type { Metadata } from "next";
import { AppLink, Chip } from "./ui";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Klubbøkter", template: "%s · Klubbøkter" },
  description: "Gode fotballøkter starter med en felles plan.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body>
        <a className="skip" href="#innhold">Hopp til innhold</a>
        <header className="site-header">
          <AppLink className="brand" href="/"><span className="brand-icon" aria-hidden="true">K</span> Klubbøkter</AppLink>
          <nav aria-label="Hovedmeny">
            <AppLink href="/oversikt">Mine klubber</AppLink>
            <Chip size="sm">Lokal utvikling · første versjon</Chip>
          </nav>
        </header>
        <main id="innhold">{children}</main>
        <footer>Mer tid på banen. Bedre flyt i planleggingen.</footer>
      </body>
    </html>
  );
}
