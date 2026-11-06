# Øktplanlegging for G2017

Prosjektet skal gjøre det enkelt å lage varierte, gjennomførbare fotballøkter for gutter født i 2017. Tiim brukes som øvelseskilde; øktene lagres i GitHub og kan deles via GitHub Pages. Denne prosjektmappen samler rammer, lokale tilpasninger og historikk.

## Ny webapp: lokal utvikling

Den nye Next.js-appen bygges ved siden av dagens øktarkiv og Pages-nettsted. Se [spesifikasjonen](docs/nettsted-spesifikasjon.md) og [implementasjonsplanen](docs/implementasjonsplan.md).

Den lokale appen har magic-link-innlogging, klubber og grupper, rolleadministrasjon, klubbprofil med logo/farger, faste treningstider, årsplan, kalender og manuell øktplanlegging med versjonshistorikk. AI, automatiske utkast, faktisk gjennomføring/evaluering, offentlig deling og Neon Auth er **ikke implementert ennå**. Appen er ikke klar for produksjonsdeploy.

### Start lokalt

Krever Node.js 24.10 eller nyere. PGlite kjører PostgreSQL innebygd i Node.js; du trenger verken Docker, databaseserver, Neon-konto eller ekstern e-post. Grensesnittet bruker HeroUI v3 med Tailwind CSS v4. Kjør fra prosjektroten:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Kopier miljøfilen bare ved første oppsett; behold egne lokale endringer senere. Åpne `http://127.0.0.1:3000`. Appen oppretter PGlite-mappen automatisk, kjører ventende Drizzle-migreringer og lukker migreringsforbindelsen **før** Next.js starter. Data beholdes på disk i `.local/pglite` ved omstart. Mappen er ignorert av Git; ingen eksempeldata eller ekte klubbdata legges inn automatisk.

Velg innlogging med e-post. En engangslenke vises i **serverterminalen**, ikke i e-post. Lenken varer i 15 minutter, og innlogget sesjon i 30 dager. Invitasjoner vises også i terminalen, varer i sju dager og må aksepteres med riktig e-postadresse. Dette er bare en lokal utviklingsflyt; lokal auth avvises uten eksplisitt lokal konfigurasjon og i produksjon, Vercel og CI.

`APP_URL` styrer appens port og lenkene som genereres. Hvis porten er opptatt, endre `APP_URL` og start appen på nytt. `PGLITE_DATA_DIR` kan settes til en annen lokal mappe; standard er `.local/pglite`. `DATABASE_URL`, `LOCAL_DB_PORT` og `LOCAL_DB_DOCKER` brukes ikke til lokal oppstart.

PGlite skal bare åpnes av én prosess om gangen. Appen deler én instans mellom forespørsler og hot reload, og en fillås hindrer andre app-/migreringsprosesser i å åpne den samme mappen. Stopp appen før du kjører separat lokal migrering. Etter en brå avslutning kan en gammel lås bruke omtrent ti sekunder på å utløpe; ikke slett databasefiler for å løse en låsefeil.

### Navigasjon og mobil

På desktop (fra 1000 piksler) vises hovedmenyen og klubb-/gruppevalgene i en fast sidemeny til venstre. På mindre skjermer åpner hamburgerknappen **Meny** én samlet meny som glir inn fra venstre, med både hovedvalg og klubb-/gruppevalg. Ingen ekstra faner eller sidemenyer vises i sideinnholdet på mobil. Menyen markerer aktiv side, holder tastaturfokus inne og lukkes med Escape, lukkeknappen, valg av lenke eller trykk på bakgrunnen. Bakgrunnssiden kan ikke rulles mens menyen er åpen. Redusert bevegelse respekteres.

- **Mine klubber** viser klubbene; **Opprett klubb** har egen side.
- **Klubb → Grupper** viser gruppene; oppretting av gruppe, **Brukere** (klubbadministratorer) og **Innstillinger** (logo/farger) har egne sider.
- **Gruppe → Oversikt** viser snarveier til kalender/årsplan og faste tider uten administrasjonsskjemaer. **Brukere** samler trenere, invitasjoner og rolleoverføring. **Innstillinger** samler treningstider og automatiseringsrammer.
- **Kalender** viser valgt måned. Årsoversikten åpnes med **Velg måned**, og **Ny enkeltøkt** åpner et separat skjema. På mobil viser kalenderdagene antall økter; klokkeslett, tema og handlinger finnes i listen under.
- **Kontoavataren** øverst til høyre viser brukerens forbokstav og åpner en egen meny med innloggingsinformasjon og **Logg ut**. Escape lukker menyen og flytter fokus tilbake til avataren.

Administratorsider og redigeringshandlinger beholder eksisterende tilgangskontroll. Lagring og valideringsfeil returnerer til den aktuelle administrasjonssiden.

### Administrere roller

Under **Klubb → Brukere** kan en klubbadministrator invitere flere administratorer, tilbakekalle invitasjoner og fjerne administratorroller. Mottakeren må logge inn med riktig e-postadresse og eksplisitt akseptere før tilgangen gis. En ny invitasjon erstatter en eventuell ubenyttet invitasjon til samme mottaker. Invitasjoner varer i sju dager.

Den siste administratoren kan ikke fjernes eller fratre før en annen har akseptert. Administratorendringer serialiseres i en databasetransaksjon. Fjerning bevarer eventuelle gruppemedlemskap, men tilbakekaller ubrukte administratorinvitasjoner til eller opprettet av personen.

Under **Gruppe → Brukere** kan klubbadministrator overføre hovedtrenerrollen til en eksisterende trener i samme gruppe. Tidligere hovedtrener blir vanlig trener, og ubrukte hovedtrenerinvitasjoner trekkes tilbake. Rollebyttet skjer samlet; vanlige trenere og hovedtrenere kan ikke utføre overføringen.

### Tidligere lokal database

Tidligere Docker-data flyttes ikke automatisk til PGlite. Eventuelle eksisterende Docker-volumer beholdes urørt. PGlite bruker samme SQL-migreringer som Neon, men erstatter ikke testing av server-/tilkoblingsoppførsel mot Neon før produksjon.

### Klubbens farger og logo

Klubbadministrator kan redigere klubbprofilen under **Klubb → Innstillinger**. Velg primær-/aksentfarge og last opp en statisk PNG, JPEG eller WebP. Forhåndsvisning endrer ikke lagret profil før **Lagre klubbprofil** velges. Primærfargen må ha minst 4,5:1 kontrast mot både hvitt og sidens lyse bakgrunn; aksentfargen får automatisk svart eller hvit tekst med minst samme kontrast.

Standarddesignet er inspirert av [Tiims øktvisning](https://tiim.no/trenerskapt/okt/a8f324d9-67fa-463d-89b6-de2a6889cc7a): blå primærfarge `#0056f5`, lys grågrønn aksent `#ecf0ea`, bakgrunn `#fafafa` og tekst `#2e2e2e`. Montserrat leveres lokalt fra en åpent lisensiert fontpakke, uten eksterne fontkall. Tiims logo, ikoner, proprietære overskriftsfont og kildekode kopieres ikke. Eksisterende lagrede klubbfarger (også tidligere standardfarger) bevares; nye klubber og tilbakestilte profiler bruker den nye standarden. Vil du beholde logoen ved bytte, velg fargene og lagre i stedet for å tilbakestille hele profilen.

Logoen kan være maksimalt 512 KiB og 2048 × 2048 piksler. Serveren kontrollerer faktisk bildeformat, filstørrelse, dimensjoner og at bildet ikke er animert. Bildet skaleres ned til maksimalt 512 × 512 piksler og kodes om til WebP uten opprinnelige metadata. SVG og eksterne logolenker støttes ikke.

Små logoer lagres som normaliserte bildedata i klubbens databasepost, ikke som filer i Git eller på Vercels midlertidige disk. Dette fungerer lokalt uten en ekstra lagringstjeneste. Farger og logo vises på klubbkort, klubbsiden og gruppesidene, med klubben som tekstalternativ for logoen. Vanlige trenere og hovedtrenere kan se profilen, men ikke endre den. Profilen påvirker ikke andre klubber eller appens globale navigasjon.

Du kan fjerne bare logoen ved neste lagring. **Tilbakestill farger og fjern logo** lagrer standardprofilen umiddelbart. Offentlige økt-/kalendersider er ennå ikke implementert; den delte profilkomponenten skal brukes også der når de bygges.

### Årsplan, kalender og øktplanlegging

Åpne en gruppe og velg **Årsplan** eller gå til kalenderen fra **Økter**. Alle gruppens trenere og klubbadministratorer kan planlegge; faste treningstider og gruppens standardrammer administreres fortsatt av hovedtrener eller klubbadministrator.

Øktvisningen har en samlet toppdel med tittel, tidspunkt, status og siste planoppdatering, faktaboks med tema/alder/varighet/oppmøte, øvingsmål og navigasjon til øvelsene. Øvelsene vises i **Oppvarming**, **Hoveddel** (temaarbeid og spill) og **Avslutning**, med varighet per del. Lagringsrekkefølgen og alle tidsverdier bevares; blandet rekkefølge gir gjentatte deloverskrifter fremfor at øvelser flyttes. Hvert kort viser gjennomføring og sammenleggbare felt for målsetting, læringsmomenter, organisering, variasjoner, ressurser og kilde. Ressurskontroll, redigering, avlysning og historiske planversjoner er fortsatt tilgjengelige. Historiske kort har egne anker-ID-er. **Skriv ut** gir en utskriftsvisning uten administrasjonsmenyer; **Rediger øktplan** åpner øktbyggeren.

- Lagre planår, eventuelt fødselsår, og årsmål. Legg til daterte temaperioder med øvingsmål og progresjon. Perioder kan gå over flere måneder innenfor samme år, men ikke overlappe.
- Kalenderen har årsoversikt og månedsvisning. Faste uketider vises som forventede treninger uten å fylle databasen med tomme øktplaner. Velg **Planlegg denne treningen**, avlys en enkeltforekomst eller opprett en ekstra enkeltøkt.
- Hver fast treningstid og økt har **Fra** og **Til**. Varighet beregnes automatisk fra tidsrommet (15–240 minutter), og gruppen har ikke en felles standardvarighet. Når en bestemt trening planlegges fra kalenderen, brukes tidsrommet fra den treningstiden, også når gruppens treninger har ulik lengde. Enkeltøkter får egne fra-/til-tider. Tidligere til-tid betyr avslutning neste dag og merkes i visningen.
- En lagret økt kan flyttes eller avlyses uten å endre ukerytmen. Opprinnelig forekomst dukker ikke opp igjen etter flytting, heller ikke ved flytting til et nytt år. Avlyste økter beholder planen og kan gjenåpnes som utkast. Endret ukerytme påvirker forventede treninger, ikke allerede lagrede økter.
- Øktbyggeren har tema, mål, rammer og ordnede øvelseskort med oppvarming, temaarbeid, spill og avslutning. Kortene har organisering, instruksjon, læringsmomenter, enklere/vanskeligere variant, kildelenke og lokale tilpasninger. Legg til, flytt og fjern kort etter behov.
- Oppgi forventet spillerantall, bekreftet treneroppmøte og tilgjengelig utstyr. Ukjente antall står tomme, ikke som null. Hvert kort er en sekvensiell blokk; oppgi **samlet** behov for alle samtidige grupper i blokken, inkludert reserveballer.
- Ufullstendige planer kan lagres som utkast. Godkjenning krever utfylte rammer, lik samlet øvelsestid og øktvarighet, samt tallkontroll mot bekreftede trenere og utstyr. Dette erstatter ikke trenerens vurdering av sikkerhet, kildeinnhold eller om organiseringen fungerer.
- Hver lagring bevarer en ny planversjon med dato, tema, rammer, godkjenningsstatus og årsplankontekst. Senere årsplanendringer endrer ikke lagrede planer. Samtidige redigeringer avvises med beskjed om å laste på nytt; redigeringer beholdes ved avvist lagring. Endring av en planlagt økt krever ny godkjenning, ellers lagres den som utkast.

Dato og klokkeslett er lokale i `Europe/Oslo`. En plan er aldri dokumentasjon på faktisk gjennomføring. Det opprettes ingen økter eller historikk i det eksisterende Markdown-/Pages-arkivet fra disse skjermene.

Ved oppgradering får eksisterende faste treningstider en beregnet til-tid ut fra gruppens tidligere varighet. Eksisterende økter og historiske versjoner får til-tid ut fra sin egen bevarte starttid og varighet, ikke fra dagens gruppedata. Den gamle gruppekolonnen beholdes som migreringsgrunnlag, men brukes ikke til nye økter eller i gruppeinnstillingene.

Fødselsår oppgis eksplisitt, ikke utledet fra gruppenavnet. Årsplanen lenker til [NFFs sportsplan/fagplan](https://www.fotball.no/barn-og-ungdom/) for beregnet alder i planåret. NFF skal være standard faglig kilde til AI-forslag til temaer og øvingsmål i steg 4; **ingen temaer genereres eller forhåndsutfylles fra NFF nå**. Strukturert øktkontrakt, kildefelt og kontekstsnapshots er klare for senere AI-generering og revisjon.

Gruppemenyen har **Økter**, **Årsplan**, **Brukere**, **Innstillinger** og **Egne øvelser**:

- Økter er gruppens startside og viser neste trening og de fem siste lagrede øktene. Faste tider uten plan vises som plassholdere med ønsket genereringsdato og knapp for manuell oppretting med treningens faktiske tidsrom. AI-jobber er ikke aktivert; datoen er ingen bekreftet bestilling. Tidligere virtuelle treningstider fremstilles ikke som gjennomførte økter. Kalenderen er fortsatt tilgjengelig fra Økter.
- Årsplan vises som et klikkbart årshjul og en vertikalt rullbar månedsoversikt med temaer, øvingsmål og progresjon. Redigering av årsretning og temaperioder beholdes under oversikten.
- Egne øvelser integrerer den eksisterende animasjonseditoren direkte i appen, uten avhengighet til GitHub Pages. Gruppemedlemskap kontrolleres også for editorens HTML og ressurser. JSON kan åpnes, redigeres og lastes ned; felles databaselagring av egne øvelser og tilknytning til øktkort gjenstår. Last ned filen før du forlater en endret tavle.

### Verifisering og migreringer

```powershell
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
```

`test:db` oppretter isolerte PGlite-databaser i midlertidige mapper og trenger verken miljøfil eller database som kjører. Testene dekker persistens etter ny åpning, migreringshistorikk, fillås, innlogging, engangslenker, invitasjoner, roller, klubb-/gruppeskille, årsplan, kalenderunntak og uforanderlige planversjoner. Enhetstestene kontrollerer også datoer, aldersbestemte NFF-lenker, kildefelt og nøyaktige tids-/utstyrsgrenser. Fiktive testdata og midlertidige mapper ryddes opp. Eksisterende taktikktavletester inngår i `npm test`.

- `npm run db:generate`: lag versjonert Drizzle-migrering etter skjemaendringer.
- `npm run db:migrate`: kjør ventende migreringer separat. Med `APP_ENV=local` brukes PGlite og lokal konfigurasjon; stopp appen først. I deployede miljøer kreves eksplisitt `DATABASE_URL` til Neon. Kommandoen er ikke del av Vercel-funksjonsoppstart.
- `npm run build`: kontroller produksjonsbygget uten å kontakte databasen. Det betyr ikke at produksjonsauth er ferdig. `npm start` skal ikke brukes for lokal auth; bruk `npm run dev`.

Produksjonsavhengighetene er kontrollert med `npm audit --omit=dev`. Det finnes foreløpig moderate varsler i utviklingsverktøyenes transitive avhengigheter (Drizzle Kit/ESLint); disse må følges opp før produksjonssetting. Ikke bruk `npm audit fix --force` uten å kontrollere verktøyenes kompatibilitet.

## Publiserte økter og verktøy

- [Alle publiserte økter](https://ingljoopt.github.io/ski-fotball-G2017/)
- [Planlagt økt: onsdag 4. november 2026](https://ingljoopt.github.io/ski-fotball-G2017/okter/udatert-uke-45-46-47.html)
- [Rediger taktikktavler](https://ingljoopt.github.io/ski-fotball-G2017/rediger-taktikk.html) – opprett en tavle eller åpne en JSON-fil.
- [Rediger firkantanimasjonen fra økten](https://ingljoopt.github.io/ski-fotball-G2017/rediger-taktikk.html?src=%2Fski-fotball-G2017%2Fmedia%2Ftaktikk%2Ffirkant-pasning.json%3Fv%3D4) – åpner den eksisterende tavlen.

Endringer i redigereren må lastes ned og legges i prosjektet før de kan publiseres. Se [arbeidsflyten for taktikktavler](docs/arbeidsflyt.md#taktikktavler).

## Start her

1. Les [prosjektbeskrivelsen](docs/produktbeskrivelse.md) og [lagets rammer](docs/rammer.md).
2. Følg [arbeidsflyten](docs/arbeidsflyt.md), og sjekk [økthistorikken](historikk/README.md) før en ny økt.
3. Finn øvelser i [øvelsesbanken](ovelsesbank/README.md). Bruk Tiim-filteret **8–9 år i 2026**, og vurder **10–12 år fra 2027**.
4. Kopier [øktmalen](maler/okt.md) til `okter/AAAA/AAAA-MM-DD-onsdag-tema.md` eller tilsvarende for søndag.
5. Lag en offentlig øktbeskrivelse fra [publiseringsmalen](maler/offentlig-okt.md), og følg [publiseringsrutinen](docs/arbeidsflyt.md#publiser-med-github-pages). Kontroller den faktiske lenken uten innlogging når økten er publisert.
6. Etter gjennomføring: før faktisk oppmøte, endringer og evaluering, og oppdater historikken.

Agentferdigheten [Øktplanlegger](.claude/skills/oktplanlegger/SKILL.md) følger denne arbeidsflyten og kan brukes i både VS Code og Claude Code, for eksempel med `/oktplanlegger`.

## Prosjektstruktur

| Mappe eller fil | Formål |
| --- | --- |
| `docs/produktbeskrivelse.md` | Mål, krav, avgrensning og ferdigkriterier |
| `docs/nettsted-spesifikasjon.md` | Krav og teknisk retning for den planlagte flerklubb-nettløsningen |
| `docs/implementasjonsplan.md` | Sjekkliste og verifisert leveransestatus for webappen |
| `src/` | Next.js-app, lokal auth, tilgangskontroll og Drizzle-skjema |
| `scripts/` | Lokal oppstart og migrering |
| `drizzle/` | Versjonerte databasemigreringer |
| `docs/rammer.md` | Spillergruppe, utstyr, årstid og organisering |
| `docs/arbeidsflyt.md` | Planlegging, kilder, GitHub-publisering og gjenbruk |
| `ovelsesbank/README.md` | Verifiserte Tiim-lenker og lokale vurderinger |
| `maler/okt.md` | Plan, utstyrsregnskap og evaluering i én fil |
| `maler/offentlig-okt.md` | Mal for offentlig øktbeskrivelse |
| `publiserte/media/taktikk/` | Datafiler for taktikktavler og animasjoner |
| `maler/periodeplan.md` | Tema og progresjon over flere uker |
| `okter/README.md` | Navngiving og lagring av økter |
| `historikk/README.md` | Register over planlagte og gjennomførte økter |
| `AGENTS.md` | Instruksjoner til framtidig arbeid i prosjektet |
| `.claude/skills/oktplanlegger/SKILL.md` | Felles agentferdighet for temabasert øktplanlegging |
| `publiserte/` | Markdown og medier for GitHub Pages |
| `.github/workflows/pages.yml` | Bygging og publisering av nettstedet |

Se [arbeidsflyten](docs/arbeidsflyt.md#taktikktavler) for å redigere og publisere egne taktikktavler med spillere, kjegler og ball. Fra en offentlig tavle kan du åpne den visuelle redigereren, laste ned JSON og legge filen i prosjektet.

Repositoriet er offentlig: også filer utenfor nettstedet kan leses på GitHub. Ikke lagre opplysninger om enkeltbarn eller annet ikke-offentlig innhold her. Ingen tidligere treninger er registrert per 4. november 2026.
