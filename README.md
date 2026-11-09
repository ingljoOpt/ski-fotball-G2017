# Øktplanlegging for G2017

Prosjektet skal gjøre det enkelt å lage varierte, gjennomførbare fotballøkter for gutter født i 2017. Tiim brukes som øvelseskilde; øktene lagres i GitHub og kan deles via GitHub Pages. Denne prosjektmappen samler rammer, lokale tilpasninger og historikk.

## Ny webapp: lokal utvikling

Den nye Next.js-appen bygges ved siden av dagens øktarkiv og Pages-nettsted. Se [spesifikasjonen](docs/nettsted-spesifikasjon.md) og [implementasjonsplanen](docs/implementasjonsplan.md).

Den lokale appen har magic-link-innlogging, klubber og lag, rolleadministrasjon, klubbprofil med logo/farger, faste treningstider, årsplan med NFF-fagplan og månedens treninger/hendelser, manuell øktplanlegging med versjonshistorikk og en AI-øktassistent. Automatiske utkast, faktisk gjennomføring/evaluering, kontroll av konkrete Tiim-øvelsessider, offentlig deling og Neon Auth er **ikke implementert ennå**. Appen er ikke klar for produksjonsdeploy.

### Start lokalt

Krever Node.js 24.10 eller nyere. PGlite kjører PostgreSQL innebygd i Node.js; du trenger verken Docker, databaseserver, Neon-konto eller ekstern e-post. Grensesnittet bruker HeroUI v3 med Tailwind CSS v4. Kjør fra prosjektroten:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:migrate
npm run dev
```

Kopier miljøfilen bare ved første oppsett; behold egne lokale endringer senere. Åpne `http://127.0.0.1:3000`. Kjør migrering manuelt ved første oppsett og etter nye Drizzle-migreringer, mens appen er stoppet. `npm run dev` starter vanlig Next.js uten et eget oppstartsskript eller automatisk migrering. Migreringskommandoen oppretter PGlite-mappen og lukker forbindelsen når den er ferdig. Data beholdes på disk i `.local/pglite` ved omstart. Mappen er ignorert av Git; ingen eksempeldata eller ekte klubbdata legges inn automatisk.

Velg innlogging med e-post. En engangslenke vises i **serverterminalen**, ikke i e-post. Lenken varer i 15 minutter, og innlogget sesjon i 30 dager. Invitasjoner vises også i terminalen, varer i sju dager og må aksepteres med riktig e-postadresse. Dette er bare en lokal utviklingsflyt; lokal auth avvises uten eksplisitt lokal konfigurasjon og i produksjon, Vercel og CI.

`APP_URL` styrer lenkene som genereres, ikke Next.js-porten. Hvis porten er opptatt, sett for eksempel `APP_URL=http://127.0.0.1:3001` i `.env.local` og start med `npm run dev -- --port 3001`. Bruk samme origin i nettleseren og `APP_URL`. Utviklingsressurser tillates også fra `127.0.0.1` gjennom `allowedDevOrigins`; Next.js startes fortsatt uten hostname-flagg. `PGLITE_DATA_DIR` kan settes til en annen lokal mappe; standard er `.local/pglite`. `DATABASE_URL`, `LOCAL_DB_PORT` og `LOCAL_DB_DOCKER` brukes ikke til lokal oppstart.

PGlite skal bare åpnes av én prosess om gangen. Appen deler én instans mellom forespørsler og hot reload, og en fillås hindrer andre app-/migreringsprosesser i å åpne den samme mappen. Stopp appen før du kjører separat lokal migrering. Etter en brå avslutning kan en gammel lås bruke omtrent ti sekunder på å utløpe; ikke slett databasefiler for å løse en låsefeil.

### Navigasjon og mobil

På desktop (fra 1000 piksler) vises hovedmenyen og klubb-/lagvalgene i en fast sidemeny til venstre. På mindre skjermer åpner hamburgerknappen **Meny** én samlet meny som glir inn fra venstre, med både hovedvalg og klubb-/lagvalg. Ingen ekstra faner eller sidemenyer vises i sideinnholdet på mobil. Menyen markerer aktiv side, holder tastaturfokus inne og lukkes med Escape, lukkeknappen, valg av lenke eller trykk på bakgrunnen. Bakgrunnssiden kan ikke rulles mens menyen er åpen. Redusert bevegelse respekteres.

- **Mine klubber** viser klubbene; **Opprett klubb** har egen side.
- **Klubb → Lag** viser lagene. **Sportsplan** viser klubbens dokumenter for trenere og administratorer; oppretting av lag, **Brukere** (klubbadministratorer) og **Innstillinger** (logo/farger) har egne sider.
- **Lag → Økter** viser neste trening og siste lagrede økter. Lagmenyen har også **Årsplan**, **Brukere**, **Innstillinger** og **Egne øvelser**. **Innstillinger** samler årgang, treningstider og automatiseringsrammer.
- **Årsplan** samler årshjul, temaer og månedsvisning av treninger og hendelser. Velg måned i hjulet, månedsmenyen eller den rullbare oversikten. På mobil viser dagene antall økter og hendelser; detaljer og handlinger finnes under. Det er ingen separat kalenderside.
- **Kontoavataren** øverst til høyre viser brukerens forbokstav og åpner en egen meny med innloggingsinformasjon og **Logg ut**. Escape lukker menyen og flytter fokus tilbake til avataren.

Administratorsider og redigeringshandlinger beholder eksisterende tilgangskontroll. Lagring og valideringsfeil returnerer til den aktuelle administrasjonssiden.

### Sportsplan og retningslinjer

**Sportsplan** i klubb- og lagmenyen viser klubbens dokumenter. Trenere kan lese Markdown og uttrukket tekst fra PDF og Word på siden, og laste ned originalene, men bare klubbadministratorer kan opprette, redigere, laste opp eller fjerne dem. Tekstuttrekk kan mangle bilder, formatering og annet innhold. Administratorer kan opprette og redigere Markdown med formateringsknapper og forhåndsvisning. HTML og bilder vises ikke i Markdown-visningen; bilder kan fremdeles finnes i originalfilen.

Klubbadministrator laster opp Markdown (.md eller .markdown, UTF-8), PDF med utvinnbar tekst eller Word (.docx) på **Sportsplan**. Flere filer kan velges samtidig. Andre klubber og offentlige lesere har ikke tilgang. Opptil fem filer kan lastes opp om gangen, hver på høyst 2 MiB. Klubben kan ha ti aktive dokumenter med høyst 50 000 tegn per dokument og 200 000 tegn til sammen. Skannede PDF-er uten utvinnbar tekst må tekstgjenkjennes før opplasting.

Øktassistenten mottar den uttrukne teksten fra alle aktive dokumenter via AI Gateway og modellleverandøren. Bilder, formatering og annen informasjon kan mangle i tekstuttrekket. Ikke last opp personopplysninger eller materiale klubben ikke har rett til å bruke. Ved redigering arkiveres den forrige versjonen, og en ny aktiv versjon opprettes. Samtidige endringer avvises uten å tømme skjemaet. For PDF og Word fjernes den aktive filen før en erstatning lastes opp. Arkiverte filer lagres i databasen, men har foreløpig ingen visning eller gjenoppretting i appen. Eksisterende lagrede øktplaner endres ikke. Dokumenter lagres i den lokale databasen, ikke i Git.

### Administrere roller

Under **Klubb → Brukere** kan en klubbadministrator invitere flere administratorer, tilbakekalle invitasjoner og fjerne administratorroller. Mottakeren må logge inn med riktig e-postadresse og eksplisitt akseptere før tilgangen gis. En ny invitasjon erstatter en eventuell ubenyttet invitasjon til samme mottaker. Invitasjoner varer i sju dager.

Den siste administratoren kan ikke fjernes eller fratre før en annen har akseptert. Administratorendringer serialiseres i en databasetransaksjon. Fjerning bevarer eventuelle lagmedlemskap, men tilbakekaller ubrukte administratorinvitasjoner til eller opprettet av personen.

Under **Lag → Brukere** kan klubbadministrator overføre hovedtrenerrollen til en eksisterende trener i samme lag. Tidligere hovedtrener blir vanlig trener, og ubrukte hovedtrenerinvitasjoner trekkes tilbake. Rollebyttet skjer samlet; vanlige trenere og hovedtrenere kan ikke utføre overføringen.

### Tidligere lokal database

Tidligere Docker-data flyttes ikke automatisk til PGlite. Eventuelle eksisterende Docker-volumer beholdes urørt. PGlite bruker samme SQL-migreringer som Neon, men erstatter ikke testing av server-/tilkoblingsoppførsel mot Neon før produksjon.

### Klubbens farger og logo

Klubbadministrator kan redigere klubbprofilen under **Klubb → Innstillinger**. Velg primær-/aksentfarge og last opp en statisk PNG, JPEG eller WebP. Forhåndsvisning endrer ikke lagret profil før **Lagre klubbprofil** velges. Primærfargen må ha minst 4,5:1 kontrast mot både hvitt og sidens lyse bakgrunn; aksentfargen får automatisk svart eller hvit tekst med minst samme kontrast.

Standarddesignet er inspirert av [Tiims øktvisning](https://tiim.no/trenerskapt/okt/a8f324d9-67fa-463d-89b6-de2a6889cc7a): blå primærfarge `#0056f5`, lys grågrønn aksent `#ecf0ea`, bakgrunn `#fafafa` og tekst `#2e2e2e`. Montserrat leveres lokalt fra en åpent lisensiert fontpakke, uten eksterne fontkall. Tiims logo, ikoner, proprietære overskriftsfont og kildekode kopieres ikke. Eksisterende lagrede klubbfarger (også tidligere standardfarger) bevares; nye klubber og tilbakestilte profiler bruker den nye standarden. Vil du beholde logoen ved bytte, velg fargene og lagre i stedet for å tilbakestille hele profilen.

Logoen kan være maksimalt 512 KiB og 2048 × 2048 piksler. Serveren kontrollerer faktisk bildeformat, filstørrelse, dimensjoner og at bildet ikke er animert. Bildet skaleres ned til maksimalt 512 × 512 piksler og kodes om til WebP uten opprinnelige metadata. SVG og eksterne logolenker støttes ikke.

Små logoer lagres som normaliserte bildedata i klubbens databasepost, ikke som filer i Git eller på Vercels midlertidige disk. Dette fungerer lokalt uten en ekstra lagringstjeneste. Farger og logo vises på klubbkort, klubbsiden og lagsidene, med klubben som tekstalternativ for logoen. Vanlige trenere og hovedtrenere kan se profilen, men ikke endre den. Profilen påvirker ikke andre klubber eller appens globale navigasjon.

Du kan fjerne bare logoen ved neste lagring. **Tilbakestill farger og fjern logo** lagrer standardprofilen umiddelbart. Offentlige økt-/kalendersider er ennå ikke implementert; den delte profilkomponenten skal brukes også der når de bygges.

### Årsplan og øktplanlegging

Klubber og lag har stabile slugs som genereres fra navnet ved oppretting, for eksempel `/ski-il-fotball/g2017/okter/[økt-id]` og `/ski-il-fotball/g2017/aarsplan?year=2026`. Klubbens slug er unik globalt; lagets slug er unik innen klubben. Æ, ø og å normaliseres, og kollisjoner eller reserverte menynavn får et unikt suffiks. Nettadressen vises i innstillingene og endres ikke ved senere navneendringer. Slugs gir ikke tilgang: medlemskap og klubbtilhørighet kontrolleres fortsatt.

Eksisterende ID-baserte klubb-/lagadresser videresendes etter tilgangskontroll, med valgt planår og meldinger bevart. Gamle kalenderlenker videresendes til årsplanen med år og måned bevart. Brukere, innstillinger, oppretting og animasjonseditor bruker også slugadresser. Migreringen fyller inn slugs på eksisterende klubber og lag uten å endre ID-er, medlemskap eller øktversjoner. Kjør `npm run db:migrate` manuelt mens appen er stoppet.

Åpne et lag og velg **Årsplan**. Alle lagets trenere og klubbadministratorer kan planlegge; faste treningstider og lagets standardrammer administreres fortsatt av hovedtrener eller klubbadministrator.

Øktvisningen har en samlet toppdel med tittel, tidspunkt, status og siste planoppdatering, faktaboks med tema/alder/varighet/oppmøte, øvingsmål og navigasjon til øvelsene. Øvelsene vises i **Oppvarming**, **Hoveddel** (temaarbeid og spill) og **Avslutning**, med varighet per del. Lagringsrekkefølgen og alle tidsverdier bevares; blandet rekkefølge gir gjentatte deloverskrifter fremfor at øvelser flyttes. Hvert kort viser gjennomføring og sammenleggbare felt for målsetting, læringsmomenter, organisering, variasjoner, ressurser og kilde. Ressurskontroll, redigering, avlysning og historiske planversjoner er fortsatt tilgjengelige. Historiske kort har egne anker-ID-er. **Skriv ut** gir en utskriftsvisning uten administrasjonsmenyer; **Rediger øktplan** åpner øktbyggeren.

- Sett eventuelt **Årgang** (for eksempel 2017) under **Lag → Innstillinger**, eller ved oppretting. Bare hovedtrener og klubbadministrator kan endre årgang. Den gjelder på tvers av årsplaner, og alder/NFF-kilde beregnes for valgt planår. Velg planår, dra inn eller bekreft hovedtemaer og tilpass daterte perioder med øvingsmål og progresjon. Perioder kan gå over flere måneder innenfor samme år, men ikke overlappe. Årsplanen opprettes atomisk når den første perioden bekreftes.
- Migreringen overfører årgang fra tidligere årsplaner bare når alle oppgitte årganger er like. Ved konflikt står årgang tom, med beskjed i laginnstillingene om hvilke verdier som må avklares. Ukjent årgang utledes ikke fra lagnavnet. Gamle årsplanverdier og øktversjoner bevares; nye kontekstsnapshots bruker lagets innstilling. Eksisterende `/grupper/…`-lenker og interne `groups`-navn beholdes.
- Årsplanens månedsvisning viser faste uketider som forventede treninger uten å fylle databasen med tomme øktplaner. Velg **Planlegg denne treningen**, avlys en enkeltforekomst eller opprett en ekstra enkeltøkt.
- Legg til, rediger og fjern **Cup**, **Ferie/fridag** eller **Annet**, med tittel, fra-/til-dato og valgfri beskrivelse. Hendelser gjelder hele dager og kan gå over måned-/årsskifter. De kan opprettes uten å lagre årsmål først. Hendelser avlyser ikke treninger automatisk; avlys aktuelle enkelttreninger eksplisitt. Nye planversjoner tar med hendelser på treningsdatoen; senere endring eller fjerning endrer ikke historiske versjoner. Oppretter/siste endrer registreres, men full hendelsesaudit er ikke implementert.
- Hver fast treningstid og økt har **Fra** og **Til**. Varighet beregnes automatisk fra tidsrommet (15–240 minutter), og laget har ikke en felles standardvarighet. Når en bestemt trening planlegges fra kalenderen, brukes tidsrommet fra den treningstiden, også når lagets treninger har ulik lengde. Enkeltøkter får egne fra-/til-tider. Tidligere til-tid betyr avslutning neste dag og merkes i visningen.
- En lagret økt kan flyttes eller avlyses uten å endre ukerytmen. Opprinnelig forekomst dukker ikke opp igjen etter flytting, heller ikke ved flytting til et nytt år. Avlyste økter beholder planen og kan gjenåpnes som utkast. Endret ukerytme påvirker forventede treninger, ikke allerede lagrede økter.
- Øktbyggeren har tema, mål, rammer og ordnede øvelseskort med oppvarming, temaarbeid, spill og avslutning. Kortene har organisering, instruksjon, læringsmomenter, enklere/vanskeligere variant, kildelenke og lokale tilpasninger. Legg til, flytt og fjern kort etter behov.
- Oppgi forventet spillerantall, bekreftet treneroppmøte og tilgjengelig utstyr. Ukjente antall står tomme, ikke som null. Hvert kort er en sekvensiell blokk; oppgi **samlet** behov for alle samtidige grupper i blokken, inkludert reserveballer.
- Ufullstendige planer kan lagres som utkast. Godkjenning krever utfylte rammer, lik samlet øvelsestid og øktvarighet, samt tallkontroll mot bekreftede trenere og utstyr. Dette erstatter ikke trenerens vurdering av sikkerhet, kildeinnhold eller om organiseringen fungerer.
- Hver lagring bevarer en ny planversjon med dato, tema, rammer, godkjenningsstatus og årsplankontekst. Senere årsplanendringer endrer ikke lagrede planer. Samtidige redigeringer avvises med beskjed om å laste på nytt; redigeringer beholdes ved avvist lagring. Endring av en planlagt økt krever ny godkjenning, ellers lagres den som utkast.

Dato og klokkeslett er lokale i `Europe/Oslo`. En plan er aldri dokumentasjon på faktisk gjennomføring. Det opprettes ingen økter eller historikk i det eksisterende Markdown-/Pages-arkivet fra disse skjermene.

Ved oppgradering får eksisterende faste treningstider en beregnet til-tid ut fra lagets tidligere varighet. Eksisterende økter og historiske versjoner får til-tid ut fra sin egen bevarte starttid og varighet, ikke fra dagens gruppedata. Den gamle gruppekolonnen beholdes som migreringsgrunnlag, men brukes ikke til nye økter eller i gruppeinnstillingene.

Fødselsår hentes fra laginnstillingene, ikke registrert på nytt i årsplanen eller utledet fra lagnavnet. Manglende årskull gir en synlig advarsel og lenke til laginnstillingene. **NFF-fagplan** åpner en uttrekkbar meny fra høyre med aldersmerkede fagplaner fra [NFF / Tiim](https://tiim.no/tema/fagplaner-og-spillmodeller). Hovedtemaene vises i stiplede felt med dra-håndtak, læringsmomenter, delferdigheter og kilder, uten en separat «Legg til periode»-knapp. Dra-og-slipp bruker `@dnd-kit/core`, ikke nettleserens native drag-hendelser. Dra-håndtaket må flyttes minst åtte piksler før drag starter. En flytende forhåndsvisning følger temaet; månedsfeltet som treffes får tydelig ramme og «Slipp for å erstatte temaet med …». Markeringen vises også når man drar over måneden i selve hjulet. Andre måneder i samme forslagperiode markeres fordi de får samme temabytte. Låste måneder er ikke slippmål. Gammelt innhold beholdes under drag, og temaet erstattes først ved gyldig slipp; Escape eller slipp utenfor et mål avbryter uten endring.

Fokuser temaet og bruk mellomrom for tastaturdrag, piltaster for å flytte og mellomrom for å slippe. Klikk på feltet åpner periodeskjemaet som alternativ. **Hovedtema for perioden** gir samme fordeling med menyvalg. Hele forslagperioden oppdateres samtidig, ikke bare måneden der valget gjøres. Mål, delferdigheter, øvingsmomenter, progresjon og kilde følger automatisk valgt NFF-hovedtema. Bruk feltet eller **Ny periode** for egne datoer. Endringer lagres først ved bekreftelse/lagring; historiske øktplaner endres ikke. Menyen er ikke-modal, så årshjulet fortsatt kan brukes mens den er åpen.

Ledige måneder får svake, stiplede forslag i månedsfeltene til høyre. Selve hjulet har vanlig månedsmarkering, uten stipling eller statusforklaring for forslag/låsing. Hovedtema foreslås i bolker på **1–2 måneder** og kan gjentas gjennom året. Dette er en lokal forslagfordeling, ikke NFFs kalender eller bekreftet trenerplan. Forslag opprettes bare i visningen, uten database- eller historikkskriving. Låsikonet ved temaoverskriften lagrer tema, mål og progresjon for den aktuelle kalendermåneden. Åpen lås betyr forslag som kan låses; lukket lås betyr låst tema og kan trykkes for å låse opp igjen. Verktøytips og tilgjengelige navn beskriver handlingen. «Rediger periode» er fjernet fra månedsfeltet. Lås opp frigjør bare den aktuelle måneden; eldre perioder over flere måneder trimmes eller deles slik at andre måneder beholdes. Øktplaner og tidligere versjoner endres ikke, og opplåsingen registreres i endringshistorikken. Tilgangs-, revisjons- og overlappskontroll beholdes. **Ny periode** gir fortsatt manuell planlegging uten NFF-kilde.

Månedsdetaljene viser foreslåtte delferdigheter med ett infoikon per ferdighet. Alle øvingsmomenter og fagdetaljer er samlet i denne popoveren, uten egne nummererte momentrader i månedsforslaget. Escape og klikk utenfor lukker den. I periodeskjemaet kan treneren velge rekkefølge og **2 eller 3 økter** per delferdighet. Rekkefølgen lagres som progresjon og styrer forslag til de forventede øktene i perioden. Uten trenerfordeling foreslås tre økter per ferdighet. Dette er planer, ikke dokumentasjon på gjennomføring.

Hver trening i månedsdetaljene har forslag til **Delferdighet for denne økten** og ett infoikon med øvingsmomentene. Nummererte momentrader og avkryssinger vises ikke her. Hovedtemaet beholdes, og foreslåtte momenter legges i øktmålene sammen med periodens mål. **Lås øktfokus** lagrer bare den aktuelle økten. En virtuell trening får da en kladd som blir i månedsoversikten; en eksisterende økt får en ny kladdversjon med tema/mål, mens øvelser, tid, rammer og tidligere versjoner bevares. Endret øktfokus er ikke godkjenning av en komplett øktplan; en tidligere godkjent plan må godkjennes på nytt. Lagrede momentvalg bevares og vises i popoveren, ikke erstattet av nye standardforslag. Automatikk overstyrer ikke allerede lagrede øktmål. Agenten får det lagrede øktfokuset og årsplanen som styrende kontekst, og ikke ulagre­de forslag som bekreftede trenerføringer.

Crawleren er en egen AI-fagplanagent med Vercel AI SDK `ToolLoopAgent`, samme Gateway-nøkkel og modelloppsett som øktassistenten. Den starter på NFFs fagplanoversikt, leser sider og velger selv relevante lenker for lagets beregnede alder (6–19 år). Nye innhentinger skjer bare når treneren trykker refresh-ikonet **Oppdater fagplan** i høyremenyen, ikke automatisk ved sidevisning eller omstart. Oppdatering kan ta tid og medfører modellkostnad. Knappen deaktiveres mens agenten arbeider. Feil gir en kort melding, og sist lagrede fagplan beholdes.

Agenten returnerer et validert objekt med `aldersklasse`, `hovedtemaer`, `delferdigheter`, `laeringsmomenter` og `merknader`. Ferdigheter defineres én gang og refereres fra hovedtemaene. Første oversikt prioriterer opptil tre læringsmomenter per hovedtema og delferdighet, ikke en komplett kopi av fagplanen. Hvert navn og moment har kilde-URL og et kort kildebelegg; serveren kontrollerer at belegget finnes på en faktisk lest side, at aldersmerkingen passer og at koblinger ikke feilmerkes som eksplisitte. Dette kontrollerer kildebeleggets tilstedeværelse, ikke faglig korrekthet eller fullstendighet. JSON-nedlasting, søk og agentens kildemerknader er fjernet fra menyen; belegg og merknader bevares i de lagrede dataene. Årsplanen bruker disse dataene, og øktassistenten får et avgrenset utvalg.

Gjeldende JSON for 8–9 år fra 8. november 2026 følger med som [startdata](src/lib/data/nff-fagplan-8-9.json), identisk med appens tidligere eksport. Dermed er planen tilgjengelig uten AI-nøkkel eller ny nettlesing. Vellykkede oppdateringer lagres atomisk i `.local/nff-curriculum/<fra>-<til>.json`, sammen med hentetidspunkt, og lastes ved neste oppstart. Oppdatering for niåringer gjelder dermed også åtteåringer. Ugyldig resultat, feil alder, kildefeil eller lagringsfeil erstatter ikke siste gode JSON. Mapper under `.local` er ignorert av Git. Lokal lagring må erstattes av et varig delt lager før flerinstans-/serverløs produksjon. Andre aldersklasser må hentes med **Oppdater fagplan** først; de får ikke 8–9-årsplanen som fallback. Lagrede årsplanperioder og øktversjoner endres ikke av en fagplanoppdatering.

Leseverktøyet tillater bare oppdagede HTTPS-lenker på `tiim.no`, `www.fotball.no` og `fotball.no`, uten innloggingsdata eller videresending. Det leser også sammenfoldede tekstpaneler, men ikke bilder, PDF eller video. `robots.txt` kontrolleres per domene; ved `Disallow`-regler stoppes innhentingen konservativt på domenet. Grensene er tolv sider, fjorten modellsteg, 180 sekunder totalt, 7000 output-tokens, tolv sekunder og 3 MB per side, samt 45 000 teksttegn per side. Avkorting og kildefeil merkes i JSON. Den lokale JSON-versjonen mellomlagres i serverprosessen, mens filen bevares ved omstart; refresh deler samtidige forespørsler for samme alder. Hentetidspunkt gjelder fagtekst, ikke NFF-godkjenning eller kontroll av konkrete øvelser. Ingen nye databaser eller migreringer kreves.

Lagmenyen har **Økter**, **Årsplan**, **Brukere**, **Innstillinger** og **Egne øvelser**:

- Økter er lagets startside og viser neste trening og de fem siste lagrede øktene. Faste tider uten plan vises som plassholdere med ønsket genereringsdato og knapp for manuell oppretting med treningens faktiske tidsrom. AI-jobber er ikke aktivert; datoen er ingen bekreftet bestilling. Tidligere virtuelle treningstider fremstilles ikke som gjennomførte økter. Årsplanen nås fra Økter.
- Årsplan vises som et klikkbart årshjul og en vertikalt rullbar månedsoversikt med forslag og låste perioder. NFF-fagplanen åpnes fra høyre. Perioder bekreftes og redigeres direkte i planleggingsflyten; treninger og hendelser vises for valgt måned, som beholdes i URL-en.
- Egne øvelser integrerer den eksisterende animasjonseditoren direkte i appen, uten avhengighet til GitHub Pages. Lagmedlemskap kontrolleres også for editorens HTML og ressurser. JSON kan åpnes, redigeres og lastes ned; felles databaselagring av egne øvelser og tilknytning til øktkort gjenstår. Last ned filen før du forlater en endret tavle.

### AI-øktassistent

Åpne en økt og velg **Rediger øktplan**. Chatten ligger som sidestolpe på brede skjermer og over skjemaet på mobil, og kan foldes sammen. Implementasjonen bruker Vercel AI SDK (`ai`) med `ToolLoopAgent`, Vercel AI Gateway og `@ai-sdk/react` (AI SDK UI) for streaming, samt eksisterende HeroUI-komponenter.

Sett `AI_GATEWAY_API_KEY` i `.env.local` og start appen på nytt. Nøkkelen skal aldri ha `NEXT_PUBLIC_`-prefiks eller legges i Git. `AI_MODEL` er en Gateway-adresse; standard er `openai/gpt-6.1-sol`. Gateway kan også bruke et gyldig `VERCEL_OIDC_TOKEN`. Uten nøkkel/token får chatten en tydelig konfigurasjonsfeil; manuell redigering fungerer fortsatt. Prioriteringsrekkefølge og trenerinnspill krever migrering `0011_ordinary_randall.sql`.

Under **Lag → Innstillinger → Prioriteringer for AI-genererte økter** lagres lagets rekkefølge. Hovedtrener og klubbadministrator kan flytte punktene med dra-og-slipp eller tastatur og velge **Lagre rammer**. Andre trenere kan lese rekkefølgen. Alle seks punkter må finnes nøyaktig én gang. Standard er klubbens retningslinjer/sportsplan, periodens tema og momenter, trenerens manuelle innspill, tidligere økter/evalueringer, tidligere årskullshistorikk i klubben og Tiim-øvelser. Nye databasefelt legges til med `0011_ordinary_randall.sql`; kjør `npm run db:migrate` mens appen er stoppet.

Agenten må først kalle `readPlanningPriorities`, deretter `readPlanningContext`, før `proposeSessionPlan` blir tilgjengelig. Verktøyene avviser forslag hvis denne rekkefølgen ikke er fulgt. Planleggingskonteksten inneholder `prioritySources` i lagets rekkefølge, med tilgjengelig/delvis/manglende grunnlag. Sikkerhet, personvern, dato/tid og bekreftede spiller-/trener-/utstyrsrammer er ufravikelige uansett prioritet. Låst tema og øktfokus skal tillegges særlig vekt innen sin prioritet; konflikter må avklares, ikke endres stille.

Ved **Ny enkeltøkt** finnes tekstfeltet **Innspill til AI-planlegging**. Innspillet lagres på økten ved manuell oppretting og sendes til agenten som trenergrunnlag. Agenten leser også gjeldende **usparte** øktinnhold, lagets årgang, årsmål, temaperioder/hendelser på datoen, lagret aldersriktig NFF-fagplan og inntil fem tidligere planer fra samme lag, med forrige plan tydelig tilgjengelig. Den kan lese opptil tre tidligere års planer fra andre lag i samme klubb for samme dokumenterte fødselsår, men bare når brukeren er klubbadministrator eller har medlemskap i det aktuelle laget. Uautoriserte lag og andre klubber ekskluderes.

Klubbens retningslinjer/sportsplan og faktiske evalueringer er ikke registrert som egne kilder ennå. Historiske planer skal aldri fremstilles som evalueringer eller dokumentasjon på gjennomføring. Tiim-grunnlaget er foreløpig kildeopplysninger og øvelsesbeskrivelser fra gjeldende/tidligere planer; nye konkrete øvelsessider hentes ikke automatisk. Agenten skal opplyse om slike mangler og ikke finne på faggrunnlaget. Tidsstyrt generering er fortsatt ikke aktivert; innstillingene brukes av den tilgjengelige AI-øktassistenten og er klare for senere automatisering.

Fagplankonteksten begrenses til 12 temaer med inntil åtte momenter per tema, prioritert mot trenerens tema/mål og årsplanen. Medlemslister, e-post, logoer og interne tenant-/bruker-ID-er sendes ikke til modellen. Chatmeldinger og dette grunnlaget sendes til Vercel AI Gateway/modellleverandøren; bruk bare treningsinnhold, aldri navn eller private opplysninger om barn. Chatten er midlertidig og forsvinner ved gjenlasting.

Agenten beholder hovedtemaet gjennom perioden og bruker trenerens delferdighetsrekkefølge og øktantall. Innen samme delferdighet skal de fleste kjente øvelsene videreføres i 2–3 økter, med små justeringer i rom, motstand, regler eller veiledning. Den skal forklare hva som videreføres og endres, ikke bytte ut alle øvelsene for variasjonens skyld. Manglende fordeling må avklares med treneren. Fagplankonteksten tar med opptil ti delferdigheter med seks momenter hver per hovedtema. Regelen styrer AI-forslag, ikke automatiske endringer i lagrede økter.

Et komplett forslag viser øvelser og kontrollpunkter. **Bruk forslaget i skjemaet** erstatter tittel, tema, øvingsmål og hele øvelsesplanen, men lagrer eller godkjenner ingenting. Har skjemaet blitt endret siden forespørselen, avvises bruk av det gamle forslaget. Treneren må deretter lagre/godkjenne via eksisterende versjonsflyt; AI-assisterte lagringer merkes i historikken med innlogget bruker som aktør. Dato, fra-/til-tid, spiller-/trenerantall og bekreftet utstyr beholdes. Endre disse i skjemaet før du ber om ny organisering.

Forslag valideres mot samme plankontrakt og faktisk øktvarighet. Agenten kan ikke finne på nytt bekreftet oppmøte/utstyr, bruke mer enn oppgitte ressurser eller oppgi nye verifiserte kilder. Eksisterende kildelenker kan gjenbrukes med tidligere treneropplysninger; de er **ikke kontrollert på nytt**. Nye lokale øvelser får ingen oppdiktet Tiim-lenke, aldersmerking eller kontrolldato. Kontroller organisering, kildegrunnlag og praktisk gjennomførbarhet selv.

Øktassistenten har ingen generell Tiim-nettleser eller kontroll av konkrete øvelsessider, evalueringer, klubbfelles veilednings-/utstyrsdokumenter, tidsstyrt generering eller varig chathistorikk. Den har maks fire modellsteg per melding, 110 sekunders tidsgrense og seks forespørsler per bruker per minutt i én serverprosess. Chat-ruten har en samlet kjøretidsramme på 320 sekunder for å romme eventuell første fagplaninnhenting før øktforslaget. Før flerinstans-produksjon må kostnadsgrenser/ratebegrensning flyttes til et delt lager.

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
