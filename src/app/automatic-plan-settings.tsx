"use client";

import { useState } from "react";
import { Input } from "@heroui/react";

export function AutomaticPlanSettings({ enabled: initialEnabled, days }: { enabled: boolean; days: number }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  return <>
    <label><input type="checkbox" name="autoDraftEnabled" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Lag plan automatisk</label>
    <label className="automatic-plan-days" hidden={!enabled}>
      Plan opprettes automatisk <Input name="generationDaysBefore" type="number" min={0} max={30} step={1} required disabled={!enabled} defaultValue={days} /> dager før ny trening
    </label>
    {!enabled && <input type="hidden" name="generationDaysBefore" value={days} />}
  </>;
}