import type { Metadata } from "next";
import { NavigationShell } from "./navigation";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-700.css";
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
        <NavigationShell>
        <main id="innhold">{children}</main>
        <footer>Mer tid på banen. Bedre flyt i planleggingen.</footer>
        </NavigationShell>
      </body>
    </html>
  );
}
