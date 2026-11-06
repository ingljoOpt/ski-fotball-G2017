"use client";

import { ActionButton } from "./ui";

export function SessionToolbar({ canEdit }: { canEdit: boolean }) {
  return <div className="session-toolbar">
    <ActionButton variant="secondary" onPress={() => window.print()}>Skriv ut</ActionButton>
    {canEdit && <a className="session-edit-link" href="#rediger-okt" onClick={() => {
      const editor = document.getElementById("rediger-okt");
      if (editor instanceof HTMLDetailsElement) editor.open = true;
    }}>Rediger øktplan</a>}
  </div>;
}
