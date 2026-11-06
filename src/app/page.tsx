import { AppLink, Card } from "./ui";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Fra sportsplan til treningsfelt</span>
          <h1>En god økt.<br />Et lag som utvikler seg.</h1>
          <p className="lead">Samle klubbens retning, trenerne og treningstidene på ett sted. Bygg et felles grunnlag for øktene som kommer.</p>
          <AppLink className="button button--primary" href="/oversikt">Åpne klubboversikten →</AppLink>
          <p><small>Første leveranse · lokal innlogging og klubbadministrasjon</small></p>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <span className="eyebrow">Sammen på banen</span>
          <div className="pitch">
            <span style={{ left: "18%", top: "28%" }} />
            <span style={{ left: "32%", top: "65%" }} />
            <span style={{ left: "65%", top: "22%" }} />
            <span style={{ left: "78%", top: "58%" }} />
            <span style={{ left: "48%", top: "46%" }} />
          </div>
        </div>
      </section>
      <section aria-label="Løsningens retning" className="grid">
        <Card className="app-card"><span className="eyebrow">01 · Organisering</span><h2>Klubben som ramme</h2><p>Opprett klubber og lag, inviter hovedtrener og la lagene organisere seg selv.</p></Card>
        <Card className="app-card"><span className="eyebrow">02 · Treningsrytme</span><h2>Lagets egne tider</h2><p>Registrer ukedager, klokkeslett, øktlengde og ønsket tidspunkt for nye utkast.</p></Card>
        <Card className="app-card"><span className="eyebrow">03 · Øktassistent</span><h2>Planer som lærer</h2><p className="muted">Få AI-forslag i øktredigeringen. Evaluering, automatikk og offentlig deling kommer i senere implementasjonssteg.</p></Card>
      </section>
    </>
  );
}
