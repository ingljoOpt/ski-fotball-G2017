"use client";

import { useState } from "react";
import { Label, Slider } from "@heroui/react";
import { differentiationCounts, type Differentiation } from "@/lib/differentiation";
import { NativeInput } from "./ui";

export function DifferentiationSettings({ settings, playerCount, coachCount }: { settings: Differentiation; playerCount: number | null; coachCount: number | null }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [players, setPlayers] = useState(playerCount?.toString() ?? "");
  const [points, setPoints] = useState([settings.levels[0].players, settings.levels[0].players + settings.levels[1].players]);
  const parsedTotal = Number(players);
  const total = players !== "" && Number.isInteger(parsedTotal) && parsedTotal >= 0 && parsedTotal <= 500 ? parsedTotal : 0;
  const counts = differentiationCounts(points, total);
  const first = counts[0];
  const second = first + counts[1];
  return <>
    <div className="form-grid">
      <NativeInput label="Antall spillere på laget" name="playerCount" type="number" min={0} max={500} step={1} required={enabled} value={players} onChange={(event) => setPlayers(event.target.value)} />
      <NativeInput label="Antall trenere på laget" name="coachCount" type="number" min={0} max={500} step={1} defaultValue={coachCount ?? ""} />
    </div>
    <small>Antallene er forventninger for nye økter, ikke bekreftet oppmøte. Uten trenerantall brukes registrerte trenerkontoer.</small>
    <label><input type="checkbox" name="differentiationEnabled" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Aktiver differensiering</label>
    <div hidden={!enabled}>
      <Slider className="differentiation-slider" minValue={0} maxValue={Math.max(total, 1)} step={1} value={[first, second]} onChange={(value) => setPoints(value as number[])} isDisabled={total === 0}>
        <Label>Fordeling av {total} spillere</Label>
        <Slider.Track style={{ backgroundImage: `linear-gradient(to right, var(--green) ${total ? first / total * 100 : 0}%, #35a179 ${total ? first / total * 100 : 0}% ${total ? second / total * 100 : 0}%, #f0ad4e ${total ? second / total * 100 : 0}%)` }}>
          <Slider.Thumb index={0} aria-label="Grense mellom nivå 1 og 2" />
          <Slider.Thumb index={1} aria-label="Grense mellom nivå 2 og 3" />
        </Slider.Track>
      </Slider>
      <div className="differentiation-scale" aria-hidden="true"><span>0</span><span>{total}</span></div>
      <div className="differentiation-summary" aria-live="polite">{counts.map((count, index) => <span key={index}>Nivå {index + 1}: <strong>{count}</strong></span>)}</div>
      {settings.levels.map((level, index) => <span key={index}>
        <input type="hidden" name={`level${index + 1}Players`} value={enabled ? counts[index] : level.players} />
        <input type="hidden" name={`level${index + 1}Groups`} value={level.groups} />
      </span>)}
    </div>
  </>;
}