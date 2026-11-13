"use client";

import { ActionButton } from "./ui";
import { Sparkles } from "lucide-react";

export function SessionToolbar({ onOpenAssistant, assistantDisabled = false, assistantOpen = false }: {
  onOpenAssistant?: () => void; assistantDisabled?: boolean; assistantOpen?: boolean;
}) {
  return <div className="session-toolbar">
    <ActionButton variant="secondary" onPress={() => window.print()}>Skriv ut</ActionButton>
    {onOpenAssistant && <ActionButton variant="secondary" onPress={onOpenAssistant} isDisabled={assistantDisabled}
      aria-controls="session-ai-drawer" aria-expanded={assistantOpen}><Sparkles size={16} aria-hidden="true" />AI-assistent</ActionButton>}
  </div>;
}
