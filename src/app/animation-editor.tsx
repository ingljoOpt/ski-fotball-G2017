"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  addAnimationFrame, addAnimationObject, animationPosition, newAnimation, readAnimation, removeAnimationObject,
  type AnimationObject, type AnimationObjectType, type AnimationScene, type Point,
} from "@/lib/animation-editor";
import { ActionButton, OptionSelect } from "./ui";

const objectNames: Record<AnimationObjectType, string> = {
  player: "Spiller", cone: "Kjegle", markerCone: "Markeringskjegle", ball: "Ball", smallGoal: "Småmål", goal: "Stort mål",
};
const describeObject = (object: AnimationObject) => `${objectNames[object.type]}${object.label ? ` ${object.label}` : ""} (${object.id})`;
const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;

function NumberField({ label, value, max, integer, onCommit, onError }: {
  label: string; value: number; max: number; integer?: boolean;
  onCommit: (value: number) => void; onError: (message: string) => void;
}) {
  const [text, setText] = useState(String(value));
  return <label>{label}<input type="number" min="0" max={max} step={integer ? 1 : "any"} value={text}
    onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
    }} onBlur={() => {
      const number = text.trim() === "" ? NaN : Number(text);
      if (!Number.isFinite(number) || number < 0 || number > max || (integer && !Number.isInteger(number))) {
        setText(String(value));
        onError(`${label} må være ${integer ? "et helt tall" : "et tall"} mellom 0 og ${max}.`);
        return;
      }
      onCommit(number);
    }} /></label>;
}

function ObjectShape({ object }: { object: AnimationObject }) {
  if (object.type === "cone") return <>
    <path className="cone-base" d="M -3 2 L 0 0.8 L 3 2 L 3 2.8 L -3 2.8 Z" />
    <path className="cone-body" d="M 0 -3 L 2.3 2 L 0 2.7 L -2.3 2 Z" />
    <path className="cone-band" d="M -1.3 -0.2 L 0 0.15 L 1.3 -0.2 L 1.8 0.9 L 0 1.35 L -1.8 0.9 Z" />
    <path className="cone-highlight" d="M -0.45 -1.8 L -1.45 0.5" />
  </>;
  if (object.type === "markerCone") return <>
    <ellipse className="marker-cone-base" cx="0" cy=".45" rx="2.3" ry=".7" />
    <path className="marker-cone-body" d="M -2 0.35 Q -1.25 -1.2 0 -1.2 Q 1.25 -1.2 2 0.35 Q 0 1 -2 0.35 Z" />
    <path className="marker-cone-highlight" d="M -1 -0.1 Q -0.6 -0.7 0 -0.8" />
  </>;
  if (object.type === "ball") return <>
    <circle className="ball-surface" r="1.8" />
    <path className="ball-shade" d="M -1.7 0.45 Q -1.3 1.8 0 1.8 Q 1.3 1.8 1.7 0.45 Q 0 1.2 -1.7 0.45 Z" />
    <path className="ball-seams" d="M 0 -0.7 L 0 -1.42 M 0.67 -0.22 L 1.3 -0.44 M 0.42 0.58 L 0.83 1.15 M -0.42 0.58 L -0.83 1.15 M -0.67 -0.22 L -1.3 -0.44" />
    <path className="ball-panel" d="M 0 -0.7 L 0.67 -0.22 L 0.42 0.58 L -0.42 0.58 L -0.67 -0.22 Z" />
  </>;
  if (object.type === "smallGoal" || object.type === "goal") {
    const width = object.type === "smallGoal" ? 4 : 7;
    const back = width - 1;
    return <>
      <path className="goal-net-background" d={`M ${-width} 1.7 L ${-width} -2.8 L ${-back} -4.8 L ${back} -4.8 L ${width} -2.8 L ${width} 1.7 L ${back} -0.3 L ${-back} -0.3 Z`} />
      <path className="goal-net" d={`M ${-back} -4.8 L ${-back} -0.3 L ${back} -0.3 L ${back} -4.8 M ${-back} -2.8 L ${back} -2.8 M 0 -4.8 L 0 -0.3`} />
      <path className="goal-frame" d={`M ${-width} 1.7 L ${-width} -2.8 L ${width} -2.8 L ${width} 1.7`} />
    </>;
  }
  return <circle r="3.5" />;
}

export function AnimationEditor({ initialScene, onSave, onCancel }: {
  initialScene: unknown; onSave: (scene: AnimationScene) => void; onCancel: () => void;
}) {
  const [initial] = useState(() => {
    try { return { scene: initialScene === undefined ? newAnimation() : readAnimation(initialScene), error: "" }; }
    catch (error) { return { scene: null, error: error instanceof Error ? error.message : "Ukjent feil." }; }
  });
  const [scene, setScene] = useState<AnimationScene | null>(initial.scene);
  const [placeholderCaptions, setPlaceholderCaptions] = useState(() =>
    initial.scene?.frames.map((frame) => frame.caption === "Beskriv steget.") ?? []);
  const [frameIndex, setFrameIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(initial.scene?.objects[0].id ?? "");
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState(initial.error ? `Kunne ikke åpne animasjonen: ${initial.error}` : "");
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof animationPosition> | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const pointer = useRef<{ id: number; objectId: string } | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const invalidNumber = useRef(false);

  useEffect(() => { editor.current?.focus(); }, []);
  useEffect(() => {
    if (!playing || !scene) return;
    let request = 0;
    let start: number | null = null;
    const offset = frameIndex * scene.durationMs;
    const tick = (time: number) => {
      if (start === null) start = time;
      const elapsed = offset + time - start;
      const state = animationPosition(scene, elapsed);
      setPreview(state);
      if (elapsed >= (scene.frames.length - 1) * scene.durationMs) {
        setFrameIndex(state.index);
        setPlaying(false);
        setPreview(null);
      } else request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    const visibility = () => { if (document.hidden) { setPlaying(false); setPreview(null); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { cancelAnimationFrame(request); document.removeEventListener("visibilitychange", visibility); };
  }, [playing, scene, frameIndex]);

  function stopPreview() { setPlaying(false); setPreview(null); }
  function change(update: (draft: AnimationScene) => void) {
    stopPreview();
    invalidNumber.current = false;
    setScene((current) => {
      if (!current) return current;
      const draft = structuredClone(current);
      update(draft);
      return draft;
    });
    setError("");
  }
  function move(id: string, point: Point) {
    change((draft) => { draft.frames[frameIndex].positions[id] = point; });
  }
  function pointerMove(event: PointerEvent<SVGGElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId || !svg.current || !scene) return;
    const matrix = svg.current.getScreenCTM();
    if (!matrix) { setError("Kan ikke finne banens plassering. Prøv igjen når tavlen er synlig."); return; }
    const point = svg.current.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    const vertical = scene.pitch?.orientation === "vertical";
    move(pointer.current.objectId, [clamp(local.x * 100 / (vertical ? 70 : 100)), clamp(local.y * 100 / (vertical ? 100 : 70))]);
  }
  function keyMove(event: KeyboardEvent<SVGGElement>, object: AnimationObject) {
    const directions: Record<string, Point> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = directions[event.key];
    if (!delta || !scene) return;
    event.preventDefault();
    const point = scene.frames[frameIndex].positions[object.id];
    const step = event.shiftKey ? 5 : 1;
    setSelectedId(object.id);
    move(object.id, [clamp(point[0] + delta[0] * step), clamp(point[1] + delta[1] * step)]);
  }
  function save() {
    if (invalidNumber.current) { invalidNumber.current = false; return; }
    try {
      if (!scene) throw new Error("Animasjonen er ikke tilgjengelig.");
      onSave(readAnimation(scene));
    } catch (issue) { setError(`Kunne ikke lagre animasjonen: ${issue instanceof Error ? issue.message : "Ukjent feil."}`); }
  }

  const object = scene?.objects.find((item) => item.id === selectedId);
  const point = scene?.frames[frameIndex].positions[selectedId];
  const vertical = scene?.pitch?.orientation === "vertical";
  const width = vertical ? 70 : 100;
  const height = vertical ? 100 : 70;
  const positions = preview?.positions ?? scene?.frames[frameIndex].positions;
  const selectedFrame = preview?.index ?? frameIndex;
  const secondary = "button button--md button--secondary";
  return <div ref={editor} tabIndex={-1} className="animation-editor" aria-label="Animasjonsbygger">
    <h3>Rediger taktikktavle</h3>
    <p>Flytt figurer på banen. Lag et nytt steg, flytt figurene igjen og forhåndsvis bevegelsen.</p>
    <p>Endringene lagres ikke automatisk. Lagre animasjonen og deretter øvelsen.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {scene && object && point && positions && <>
      <div className="animation-editor-layout">
        <section aria-label="Bane">
          <h4>Bane</h4>
          <div className="animation-editor-coordinates">
            <OptionSelect label="Retning" value={scene.pitch?.orientation ?? "horizontal"} options={[
              { id: "horizontal", label: "Horisontal" }, { id: "vertical", label: "Vertikal" },
            ]} onChange={(value) => {
              const orientation = value === "vertical" ? "vertical" : "horizontal";
              change((draft) => { draft.pitch = { orientation, size: draft.pitch?.size ?? "large" }; });
            }} />
            <OptionSelect label="Størrelse" value={scene.pitch?.size ?? "large"} options={[
              { id: "small", label: "Liten" }, { id: "medium", label: "Medium" }, { id: "large", label: "Stor" },
            ]} onChange={(value) => {
              const size = value === "small" ? "small" : value === "medium" ? "medium" : "large";
              change((draft) => { draft.pitch = { orientation: draft.pitch?.orientation ?? "horizontal", size }; });
            }} />
          </div>
          <p>Velg en figur og dra den. Du kan også bruke piltastene.</p>
          <svg ref={svg} className="tactic-pitch animation-editor-pitch" data-size={scene.pitch?.size ?? "large"}
            viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Taktikktavle. Velg en figur for å flytte den.">
            <rect x="1" y="1" width={width - 2} height={height - 2} rx="2" className="pitch-background" />
            <rect x="5" y="5" width={width - 10} height={height - 10} className="pitch-line" />
            <line x1={vertical ? 5 : 50} y1={vertical ? 50 : 5} x2={vertical ? 65 : 50} y2={vertical ? 50 : 65} className="pitch-line" />
            <circle cx={width / 2} cy={height / 2} r="8" className="pitch-line" />
            {scene.objects.map((item) => {
              const position = positions[item.id];
              return <g key={item.id} className={`tactic-${item.type}`} data-selected={item.id === selectedId}
                transform={`translate(${position[0] * width / 100} ${position[1] * height / 100})${item.rotation ? ` rotate(${item.rotation})` : ""}`}
                role="button" tabIndex={0} aria-label={`${describeObject(item)}, x ${position[0]}, y ${position[1]}. Bruk piltastene for å flytte.`}
                onFocus={() => { stopPreview(); setSelectedId(item.id); }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault(); stopPreview(); setSelectedId(item.id);
                  pointer.current = { id: event.pointerId, objectId: item.id };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }} onPointerMove={pointerMove}
                onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }}
                onKeyDown={(event) => keyMove(event, item)}>
                <ObjectShape object={item} />
                {item.label && <text x="0" y="0" textAnchor="middle" dominantBaseline="central">{item.label}</text>}
              </g>;
            })}
          </svg>
          <h4>Steg</h4>
          <label>Velg steg {selectedFrame + 1} av {scene.frames.length}
            <input type="range" min="0" max={scene.frames.length - 1} value={selectedFrame}
              aria-valuetext={`Steg ${selectedFrame + 1} av ${scene.frames.length}`} onChange={(event) => {
                stopPreview(); setFrameIndex(Number(event.target.value));
              }} />
          </label>
          <div className="exercise-add-fields">
            <button type="button" className={secondary} disabled={frameIndex === 0} onClick={() => { stopPreview(); setFrameIndex(frameIndex - 1); }}>Forrige steg</button>
            <button type="button" className={secondary} disabled={frameIndex === scene.frames.length - 1} onClick={() => { stopPreview(); setFrameIndex(frameIndex + 1); }}>Neste steg</button>
            <button type="button" className={secondary} disabled={scene.frames.length < 2} onClick={() => {
              if (playing) { stopPreview(); return; }
              try {
                readAnimation(scene);
                if (frameIndex === scene.frames.length - 1) setFrameIndex(0);
                setPlaying(true); setError("");
              } catch (issue) { setError(`Kan ikke forhåndsvise: ${issue instanceof Error ? issue.message : "Ukjent feil."}`); }
            }}>{playing ? "Pause forhåndsvisning" : "Spill av forhåndsvisning"}</button>
            <button type="button" className={secondary} onClick={() => {
              const next = frameIndex + 1;
              change((draft) => { addAnimationFrame(draft, frameIndex); }); setFrameIndex(next);
              setPlaceholderCaptions((current) => [...current.slice(0, next), current[frameIndex], ...current.slice(next)]);
            }}>Kopier til nytt steg</button>
            <button type="button" className={secondary} disabled={scene.frames.length <= 1} onClick={() => {
              change((draft) => { draft.frames.splice(frameIndex, 1); }); setFrameIndex(Math.min(frameIndex, scene.frames.length - 2));
              setPlaceholderCaptions((current) => current.filter((_, index) => index !== frameIndex));
            }}>Slett steg</button>
          </div>
          {!placeholderCaptions[selectedFrame] && scene.frames[selectedFrame].caption.trim() &&
            <p aria-live="polite">{scene.frames[selectedFrame].caption}</p>}
        </section>
        <section aria-label="Figurer">
          <h4>Figurer</h4>
          <OptionSelect label="Valgt figur" value={selectedId} options={scene.objects.map((item) => ({ id: item.id, label: describeObject(item) }))}
            onChange={(value) => { if (typeof value === "string") { stopPreview(); setSelectedId(value); } }} />
          <label>Merke på figuren, maks 3 tegn<input maxLength={3} value={object.label ?? ""} onChange={(event) => {
            const value = event.target.value;
            change((draft) => { const item = draft.objects.find((entry) => entry.id === selectedId); if (item) { if (value) item.label = value; else delete item.label; } });
          }} /></label>
          {(object.type === "smallGoal" || object.type === "goal") && <NumberField key={`${selectedId}-${object.rotation ?? 0}`}
            label="Rotasjon (0–359)" value={object.rotation ?? 0} max={359} integer onError={(message) => { invalidNumber.current = true; setError(message); }} onCommit={(value) => {
              change((draft) => { const item = draft.objects.find((entry) => entry.id === selectedId); if (item) item.rotation = value; });
            }} />}
          <div className="exercise-add-fields">
            {(Object.keys(objectNames) as AnimationObjectType[]).map((type) => <button key={type} type="button" className={secondary} onClick={() => {
              const draft = structuredClone(scene); const id = addAnimationObject(draft, type);
              stopPreview(); setScene(draft); setSelectedId(id); setError("");
            }}>Legg til {objectNames[type].toLocaleLowerCase("nb")}</button>)}
            <button type="button" className={secondary} disabled={scene.objects.length <= 1} onClick={() => {
              change((draft) => { removeAnimationObject(draft, selectedId); });
              setSelectedId(scene.objects.find((item) => item.id !== selectedId)?.id ?? "");
            }}>Slett valgt figur</button>
          </div>
          <p>Nye og slettede figurer og målrotasjon gjelder alle stegene. Flytting gjelder bare valgt steg.</p>
          <label className="animation-editor-toggle"><input type="checkbox" checked={advanced} onChange={(event) => setAdvanced(event.target.checked)} /> Vis avansert</label>
          {advanced && <>
            <label>Beskrivelse av steget<textarea value={placeholderCaptions[frameIndex] ? "" : scene.frames[frameIndex].caption} onChange={(event) => {
              const value = event.target.value;
              setPlaceholderCaptions((current) => current.map((placeholder, index) => index === frameIndex ? false : placeholder));
              change((draft) => { draft.frames[frameIndex].caption = value; });
            }} /></label>
            <label>Beskrivelse av hele tavlen<textarea value={scene.description} onChange={(event) => {
              const value = event.target.value; change((draft) => { draft.description = value; });
            }} /></label>
            <label>Tid per overgang i millisekunder (100–60000)<input type="number" min="100" max="60000"
              value={Number.isFinite(scene.durationMs) ? scene.durationMs : ""} onChange={(event) => {
                const value = event.target.valueAsNumber; change((draft) => { draft.durationMs = value; });
              }} /></label>
          </>}
        </section>
      </div>
    </>}
    <div className="exercise-form-actions">
      <ActionButton type="button" isDisabled={!scene} onPress={save}>Lagre</ActionButton>
      <ActionButton type="button" variant="secondary" onPress={onCancel}>Avbryt</ActionButton>
    </div>
  </div>;
}
