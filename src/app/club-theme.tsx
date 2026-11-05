import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { foregroundFor, type ClubBranding } from "@/lib/branding";

export function ClubTheme({ club, children }: { club: ClubBranding; children: ReactNode }) {
  const style: CSSProperties & Record<`--${string}`, string> = {
    "--green": club.primaryColor,
    "--accent": club.primaryColor,
    "--accent-hover": club.primaryColor,
    "--accent-foreground": "#ffffff",
    "--accent-soft-foreground": club.primaryColor,
    "--accent-soft": "#ffffff",
    "--accent-soft-hover": "#ffffff",
    "--focus": club.primaryColor,
    "--club-primary": club.primaryColor,
    "--club-accent": club.accentColor,
    "--club-accent-foreground": foregroundFor(club.accentColor),
  };
  return <section className="club-theme" style={style}>{children}</section>;
}

export function ClubIdentity({ club }: { club: ClubBranding }) {
  return <div className="club-identity">
    {club.logoData && <Image className="club-logo" src={club.logoData} width={96} height={96} unoptimized alt={`Logo for ${club.name}`} />}
    <span>{club.name}</span>
  </div>;
}
