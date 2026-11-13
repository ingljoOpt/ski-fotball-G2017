type Entry = {
  id: string;
  planYear: number;
  entityType: "session" | "annual_plan" | "plan_period";
  action: "created" | "updated" | "deleted" | "status_changed";
  actorType: "user" | "ai" | "system";
  actorEmail: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  createdAt: Date;
};

const actionLabels = { created: "Opprettet", updated: "Endret", deleted: "Slettet", status_changed: "Status endret" };
const entityLabels = { session: "Økt", annual_plan: "Årsplan", plan_period: "Temaperiode" };
const fieldLabels: Record<string, string> = {
  date: "Dato", startTime: "Fra", endTime: "Til", durationMinutes: "Varighet", title: "Tittel",
  theme: "Tema", objectives: "Mål og føringer", coachMoments: "Trenernes øvingsmomenter", status: "Status", introduction: "Introduksjon",
  expectedPlayers: "Forventet antall spillere", confirmedCoaches: "Planlagte trenere",
  coachIds: "Trenerutvalg", coachIdsForExercises: "Trenergrunnlag for øvelser", coachAttendanceConfirmed: "Treneroppmøte bekreftet",
  availableBalls: "Tilgjengelige baller", availableSmallGoals: "Små mål", availableLargeGoals: "Store mål",
  equipmentConfirmed: "Utstyr bekreftet", assumptions: "Forutsetninger", coachRoles: "Trenerroller",
  alternatives: "Alternativer", progression: "Progresjon", exercises: "Øvelser", organization: "Organisering",
  description: "Beskrivelse", coachingPoints: "Coachingpunkter", easier: "Enklere", harder: "Vanskeligere",
  localAdaptations: "Lokale tilpasninger", sourceUrl: "Kildelenke", sourceAge: "Kildealder",
  sourceCheckedOn: "Kilde kontrollert", simultaneousGroups: "Samtidige grupper", assignedPlayers: "Tildelte spillere",
  coaches: "Trenere", balls: "Baller", reserveBalls: "Reserveballer", smallGoals: "Små mål", largeGoals: "Store mål",
  noSpecialResources: "Ingen særskilt gruppeinndeling eller utstyr",
  year: "Planår", startDate: "Fra dato", endDate: "Til dato", schemaVersion: "Skjemaversjon",
};
const statusLabels: Record<string, string> = { draft: "Øktplan", planned: "Øktplan", cancelled: "Avlyst" };

function flatten(value: unknown, path = "", result: Record<string, unknown> = {}) {
  if ((value === null || value === undefined) && !path) return result;
  if (Array.isArray(value)) {
    if (!value.length) result[path] = value;
    else value.forEach((item, index) => flatten(item, `${path}.${index + 1}`, result));
  } else if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) result[path] = value;
    else entries.forEach(([key, item]) => flatten(item, path ? `${path}.${key}` : key, result));
  } else result[path] = value;
  return result;
}

function formatValue(value: unknown, path: string) {
  if (value === null || value === undefined || value === "") return "Tomt";
  if (typeof value === "boolean") return value ? "Ja" : "Nei";
  if (path.endsWith(".status") && typeof value === "string" && statusLabels[value]) return statusLabels[value];
  if (Array.isArray(value)) return value.length ? JSON.stringify(value) : "Ingen";
  return String(value);
}

function changes(entry: Entry) {
  const before = flatten(entry.beforeSnapshot);
  const after = flatten(entry.afterSnapshot);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}

function describeEntity(entry: Entry) {
  const snapshot = entry.afterSnapshot ?? entry.beforeSnapshot;
  const event = snapshot?.event as Record<string, unknown> | undefined;
  const title = entry.entityType === "session" ? event?.title : snapshot?.theme;
  return `${entityLabels[entry.entityType]}${title ? ` · ${String(title)}` : ` · ${entry.planYear}`}`;
}

function fieldLabel(path: string) {
  return path.split(".").map((part, index) => {
    if (index === 0 && part === "event") return "Økt";
    if (index === 0 && part === "plan") return "Plan";
    if (/^\d+$/.test(part)) return `Øvelse ${part}`;
    return fieldLabels[part] ?? part;
  }).join(" · ");
}

function actorLabel(entry: Entry) {
  if (entry.actorType === "ai") return entry.actorEmail ? `AI, bestilt av ${entry.actorEmail}` : "AI";
  if (entry.actorType === "system") return "System";
  return entry.actorEmail ?? "Bruker";
}

export function PlanningHistory({ entries }: { entries: Entry[] }) {
  return <section className="planning-history" aria-label="Endringshistorikk">
    <h2>Endringshistorikk</h2>
    {!entries.length ? <p className="muted">Ingen endringer er registrert ennå.</p> : <ol className="clean">
      {entries.map((entry) => <li key={entry.id}>
        <details className="exercise-detail">
          <summary>{actionLabels[entry.action]} · {describeEntity(entry)} · {actorLabel(entry)} · {new Intl.DateTimeFormat("nb-NO", {
            dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo",
          }).format(entry.createdAt)}</summary>
          <dl className="history-changes">
            {changes(entry).map((change) => <div key={change.key}>
              <dt>{fieldLabel(change.key)}</dt>
              <dd>{formatValue(change.before, change.key)} <span aria-hidden="true">→</span> {formatValue(change.after, change.key)}</dd>
            </div>)}
          </dl>
        </details>
      </li>)}
    </ol>}
  </section>;
}