"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AppLink } from "./ui";

type Item = { href: string; label: string };

const MobileNavigationTarget = createContext<HTMLDivElement | null>(null);

export function NavigationShell({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <MobileNavigationTarget.Provider value={target}>
    <SiteHeader setMobileTarget={setTarget} />
    {children}
  </MobileNavigationTarget.Provider>;
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

function SiteHeader({ setMobileTarget }: { setMobileTarget: (target: HTMLDivElement | null) => void }) {
  const menu = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const items: Item[] = [{ href: "/oversikt", label: "Mine klubber" }];
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
  return <><header className="site-header">
    <AppLink className="brand" href="/oversikt"><span className="brand-icon" aria-hidden="true">K</span> Klubbøkter</AppLink>
    <div className="header-controls">
      <button className="main-menu" type="button" aria-label="Hovedmeny" aria-haspopup="dialog"
        aria-controls="mobile-navigation" onClick={() => menu.current?.showModal()}>
        <span className="hamburger" aria-hidden="true"><i /><i /><i /></span><span>Meny</span>
      </button>
    </div>
  </header>
    <dialog id="mobile-navigation" className="mobile-drawer" ref={menu} aria-labelledby="mobile-navigation-title"
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
    <aside className="desktop-sidebar">
      <span className="eyebrow">Trenerrom</span>
      <NavigationLinks items={items.filter((item) => item.href === "/oversikt")} label="Sidemeny" />
      <small>Lokal utvikling</small>
    </aside>
  </>;
}
