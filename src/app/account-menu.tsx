"use client";

import { useRef } from "react";
import { signOut } from "./actions";
import { SubmitButton } from "./ui";

export function Account({ email }: { email: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return <details className="account-menu" ref={menu} onKeyDown={(event) => {
    if (event.key === "Escape" && menu.current?.open) {
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
  }}>
    <summary aria-label="Åpne kontomeny" title="Konto">
      <span className="account-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span>
    </summary>
    <div className="account-panel">
      <strong>Din konto</strong>
      <small>{email}</small>
      <form action={signOut}><SubmitButton variant="secondary">Logg ut</SubmitButton></form>
    </div>
  </details>;
}
