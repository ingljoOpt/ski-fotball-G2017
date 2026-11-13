"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { addTeamCoach, updateTeamCoach } from "@/app/actions";
import { ActionButton, TextInput } from "@/app/ui";

export function CoachDialog({ groupId, coach }: {
  groupId: string; coach?: { id: string; name: string; email: string | null; hasAccount: boolean };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const router = useRouter();
  const [name, setName] = useState(coach?.name ?? "");
  const [email, setEmail] = useState(coach?.email ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const title = coach ? "Rediger trener" : "Legg til trener";
  const emailLocked = Boolean(coach?.email || coach?.hasAccount);

  function closeDialog() {
    dialog.current?.close();
    setName(coach?.name ?? ""); setEmail(coach?.email ?? ""); setError("");
    router.refresh();
  }

  return <>
    {coach ? <span title={title}><ActionButton className="coach-edit" type="button" variant="ghost" aria-label={`${title} ${coach.name}`}
      onPress={() => { setName(coach.name); setEmail(coach.email ?? ""); dialog.current?.showModal(); }}><Pencil size={17} aria-hidden="true" /></ActionButton></span>
      : <ActionButton type="button" onPress={() => dialog.current?.showModal()}><Plus size={17} aria-hidden="true" /> Legg til trener</ActionButton>}
    <dialog ref={dialog} className="training-time-dialog" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!pending) closeDialog(); }}>
      <h2 id={titleId}>{title}</h2>
      <form onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          try {
            const result = await (coach ? updateTeamCoach(form) : addTeamCoach(form));
            if (result.saved) closeDialog();
            else setError(result.message);
          } catch (issue) {
            console.error("Treneren kunne ikke lagres:", issue);
            setError("Lagringen feilet. Opplysningene er beholdt; prøv igjen.");
          }
        });
      }}>
        <input type="hidden" name="groupId" value={groupId} />
        {coach && <input type="hidden" name="coachId" value={coach.id} />}
        <TextInput label="Navn" name="name" isRequired minLength={2} maxLength={254} value={name} onChange={setName} />
        <TextInput label={emailLocked ? "E-postadresse" : "E-postadresse (valgfritt)"} type="email" name="email" maxLength={254} value={email} onChange={setEmail} isReadOnly={emailLocked} />
        <small>E-post kan ikke endres eller fjernes etter lagring. For å bruke en annen adresse må treneren fjernes og opprettes på nytt. Tidligere øktplaner kobles ikke automatisk til den nye treneren.</small>
        <small>E-post må være registrert for at treneren skal kunne inviteres til appen. Velg «Inviter til appen» etter lagring; tilgang gis først når invitasjonen er akseptert.</small>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="row">
          <ActionButton type="submit" isPending={pending} isDisabled={pending}>{coach ? "Lagre trener" : "Legg til trener"}</ActionButton>
          <ActionButton type="button" variant="secondary" isDisabled={pending} onPress={closeDialog}>Avbryt</ActionButton>
        </div>
      </form>
    </dialog>
  </>;
}
