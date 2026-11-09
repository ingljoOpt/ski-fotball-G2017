"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionReview } from "@/lib/session-review";
import { saveReview } from "./actions";
import { SubmitButton, TextAreaInput } from "./ui";

export function SessionReviewForm({ groupId, eventId, eventRevision, versionId, exercises, review, reviewRevision }: {
  groupId: string; eventId: string; eventRevision: number; versionId: string;
  exercises: { id: string; title: string }[]; review?: SessionReview; reviewRevision: number;
}) {
  const [state, action] = useActionState(saveReview, { message: "", saved: false });
  const [comment, setComment] = useState(review?.comment ?? "");
  const [values, setValues] = useState(() => Object.fromEntries(exercises.map((exercise) => {
    const previous = review?.exercises.find((item) => item.exerciseId === exercise.id);
    return [exercise.id, { rating: previous?.rating?.toString() ?? "", comment: previous?.comment ?? "" }];
  })));
  const router = useRouter();
  useEffect(() => { if (state.saved) router.refresh(); }, [state, router]);

  return <form action={action} className="stack">
    <input type="hidden" name="groupId" value={groupId} />
    <input type="hidden" name="eventId" value={eventId} />
    <input type="hidden" name="versionId" value={versionId} />
    <input type="hidden" name="eventRevision" value={eventRevision} />
    <input type="hidden" name="reviewRevision" value={reviewRevision} />
    {exercises.map((exercise) => <fieldset className="review-exercise" key={exercise.id}>
      <legend>{exercise.title}</legend>
      <input type="hidden" name="exerciseId" value={exercise.id} />
      <fieldset className="review-rating"><legend>Vurdering (0–5)</legend>
        {["", "0", "1", "2", "3", "4", "5"].map((rating) => <label key={rating}>
          <input type="radio" name={`rating.${exercise.id}`} value={rating} checked={values[exercise.id].rating === rating}
            onChange={() => setValues((current) => ({ ...current, [exercise.id]: { ...current[exercise.id], rating } }))} />
          {rating || "Ikke vurdert"}
        </label>)}
      </fieldset>
      <TextAreaInput label={`Kommentar til ${exercise.title}`} name={`comment.${exercise.id}`} rows={2} maxLength={2000}
        value={values[exercise.id].comment} onChange={(event) => setValues((current) => ({
          ...current, [exercise.id]: { ...current[exercise.id], comment: event.target.value },
        }))} />
    </fieldset>)}
    <TextAreaInput label="Kommentar til hele økten" name="comment" rows={3} maxLength={4000} value={comment}
      onChange={(event) => setComment(event.target.value)} />
    <small>Ikke skriv navn eller private opplysninger om barn.</small>
    {state.message && <p className={state.saved ? "notice" : "notice error"} role={state.saved ? "status" : "alert"}>{state.message}</p>}
    <SubmitButton>Lagre evaluering</SubmitButton>
  </form>;
}