"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { foregroundFor, type ClubBranding } from "@/lib/branding";
import { AppLink } from "./ui";

type Item = { href: string; label: string };

const MobileNavigationTarget = createContext<HTMLDivElement | null>(null);
const ClubHeaderState = createContext<(club: ClubBranding | null) => void>(() => {});

export function NavigationShell({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [clubHeader, setClubHeader] = useState<ClubBranding | null>(null);
  return <MobileNavigationTarget.Provider value={target}>
    <ClubHeaderState.Provider value={setClubHeader}>
      <SiteHeader setMobileTarget={setTarget} club={clubHeader} />
      {children}
    </ClubHeaderState.Provider>
  </MobileNavigationTarget.Provider>;
}

export function ClubHeader({ club }: { club: ClubBranding }) {
  const setClubHeader = useContext(ClubHeaderState);
  useEffect(() => {
    setClubHeader(club);
    return () => setClubHeader(null);
  }, [club, setClubHeader]);
  return null;
}

export function NavigationLinks({ items, label, className = "" }: { items: Item[]; label: string; className?: string }) {
  const pathname = usePathname();
  const target = useContext(MobileNavigationTarget);
  const activeHref = items.find((item) => pathname === item.href.split("?")[0])?.href
    ?? items.find((item) => item.label === "Økter" &&
      (pathname === `${item.href}/okter` || pathname.startsWith(`${item.href}/okter/`)))?.href;
  const links = items.map((item) => <a href={item.href} key={item.href}
    aria-current={activeHref === item.href ? "page" : undefined}>{item.label}</a>);
  if (className.includes("context-navigation")) return <>
    <nav className={`section-navigation ${className}`} aria-label={label}>{links}</nav>
    {target && createPortal(<nav className="section-navigation" aria-label={label}>{links}</nav>, target)}
  </>;
  return <nav className={`section-navigation ${className}`} aria-label={label}>
    {links}
  </nav>;
}

function SiteHeader({ setMobileTarget, club }: {
  setMobileTarget: (target: HTMLDivElement | null) => void;
  club: ClubBranding | null;
}) {
  const menu = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const items: Item[] = [{ href: "/oversikt", label: "Mine klubber" }];
  const clubNavigationStyle = club ? {
    "--green": club.primaryColor,
    "--club-accent": club.accentColor,
    "--club-accent-foreground": foregroundFor(club.accentColor),
  } as CSSProperties : undefined;
  useEffect(() => { menu.current?.close(); }, [pathname]);
  useEffect(() => {
    const dialog = menu.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dialog?.open) {
        event.preventDefault();
        dialog.close();
      }
    };
    dialog?.addEventListener("keydown", closeOnEscape);
    const desktop = window.matchMedia("(min-width: 1000px)");
    const closeOnDesktop = () => { if (desktop.matches) menu.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      dialog?.removeEventListener("keydown", closeOnEscape);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, []);
  return <><header className={club ? "site-header site-header--club" : "site-header"}
    style={club ? { backgroundColor: club.accentColor, color: foregroundFor(club.accentColor) } : undefined}>
    {club ? <AppLink className="brand club-header-brand" href="/oversikt">
      {club.logoData && <Image className="club-header-logo" src={club.logoData} width={48} height={48} unoptimized alt="" />}
      {club.name}
    </AppLink> : <AppLink className="brand" href="/oversikt"><span className="brand-icon" aria-hidden="true">K</span> Klubbøkter</AppLink>}
    <div className="header-controls">
      <button className="main-menu" type="button" aria-label="Hovedmeny" aria-haspopup="dialog"
        aria-controls="mobile-navigation" onClick={() => menu.current?.showModal()}>
        <span className="hamburger" aria-hidden="true"><i /><i /><i /></span><span>Meny</span>
      </button>
    </div>
  </header>
    <dialog id="mobile-navigation" className={club ? "mobile-drawer mobile-drawer--club" : "mobile-drawer"}
      style={clubNavigationStyle} ref={menu} aria-labelledby="mobile-navigation-title"
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
          || (event.target instanceof Element && event.target.closest("a"))) menu.current?.close();
      }}>
      <div className="drawer-heading">
        <h2 id="mobile-navigation-title">Meny</h2>
        <button type="button" aria-label="Lukk meny" onClick={() => menu.current?.close()}>×</button>
      </div>
      <NavigationLinks items={items} label="Hovedmeny" />
      <div className="drawer-context" ref={setMobileTarget} />
      <small>Lokal utvikling</small>
    </dialog>
    <aside className={club ? "desktop-sidebar desktop-sidebar--club" : "desktop-sidebar"} style={clubNavigationStyle}>
      <span className="eyebrow">Trenerrom</span>
      <NavigationLinks items={items.filter((item) => item.href === "/oversikt")} label="Sidemeny" />
      <small>Lokal utvikling</small>
    </aside>
  </>;
}
