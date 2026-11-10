"use client";

import { useId, useRef } from "react";
import { Pencil, Plus } from "lucide-react";
import { newTrainingTime, saveTrainingTime } from "@/app/actions";
import { ActionButton, NativeInput, SubmitButton, WeekdaySelect, weekdays } from "@/app/ui";

export function NewTrainingTimeDialog({ groupId, time, playerCount, coachCount }: {
  groupId: string; time?: { id: string; weekday: number; startTime: string; endTime: string; expectedPlayers: number | null; expectedCoaches: number | null };
  playerCount: number | null; coachCount: number | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const title = time ? "Rediger treningstid" : "Legg til treningstid";
  return <>
    {time ? <span title={title}><ActionButton className="training-time-edit" type="button" variant="ghost" aria-label={`${title} ${weekdays[time.weekday - 1]} ${time.startTime}`} onPress={() => dialog.current?.showModal()}><Pencil size={17} aria-hidden="true" /></ActionButton></span>
      : <ActionButton type="button" onPress={() => dialog.current?.showModal()}><Plus size={17} aria-hidden="true" /> Legg til treningstid</ActionButton>}
    <dialog ref={dialog} className="training-time-dialog" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      <form action={time ? saveTrainingTime : newTrainingTime} onSubmit={() => dialog.current?.close()}>
        <input type="hidden" name="groupId" value={groupId} />
        {time && <input type="hidden" name="timeId" value={time.id} />}
        <WeekdaySelect native defaultValue={String(time?.weekday ?? 1)} />
        <div className="form-grid">
          <NativeInput label="Fra" type="time" name="startTime" required defaultValue={time?.startTime} />
          <NativeInput label="Til" type="time" name="endTime" required defaultValue={time?.endTime} />
        </div>
        <div className="form-grid">
          <NativeInput label="Forventet antall spillere" name="expectedPlayers" type="number" min={0} max={500} step={1} defaultValue={time?.expectedPlayers ?? ""} placeholder={playerCount?.toString() ?? "Ikke oppgitt"} />
          <NativeInput label="Forventet antall trenere" name="expectedCoaches" type="number" min={0} max={500} step={1} defaultValue={time?.expectedCoaches ?? ""} placeholder={coachCount?.toString() ?? "Alle registrerte"} />
        </div>
        <small>Tomt felt bruker lagets antall. Lagrede økter endres ikke.</small>
        <small>Tidsrom: 15–240 minutter. En tidligere til-tid betyr avslutning neste dag.</small>
        <div className="row"><SubmitButton>{time ? "Lagre endringer" : "Legg til treningstid"}</SubmitButton><ActionButton type="button" variant="ghost" onPress={() => dialog.current?.close()}>Avbryt</ActionButton></div>
      </form>
    </dialog>
  </>;
}