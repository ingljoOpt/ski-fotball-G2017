# Spesifikasjon: digital løsning for klubbøkter

## Status og formål

Dette dokumentet beskriver ønsket produkt og teknisk retning for en nettbasert løsning for planlegging, gjennomføring og deling av fotballøkter. Det er en kravspesifikasjon, ikke dokumentasjon på at funksjonene allerede er bygget.

Løsningen skal hjelpe flere klubber og trenergrupper med å lage praktiske, varierte økter basert på klubbens sportsplan, gruppens periodeplan, tidligere evalueringer, oppmøte, trenere og tilgjengelig utstyr. Trenere skal kunne bruke både manuell redigering og AI-støtte. Ferdige økter og utvalgte kalendere skal kunne deles som lesbare sider uten innlogging.

## Brukere og tilgang

| Rolle | Tilgang |
| --- | --- |
| Klubbadministrator | Administrere klubb, klubbadministratorer, undergrupper, felles sportsplan, veiledning, utstyr og invitasjoner |
| Hovedtrener | Gruppens administrator. Administrere gruppens medlemmer og innstillinger, treningstider, planer, økter og deling; lese klubbens felles innhold |
| Trener | Tilgang til grupper vedkommende er invitert til; lese klubbens felles innhold, planlegge og redigere økter, bruke AI, registrere evaluering og administrere deling innenfor gruppens regler |
| Offentlig leser | Se kun økter eller kalenderinnhold som er eksplisitt delt med en aktiv, skrivebeskyttet lenke |

En bruker kan være medlem av flere klubber og grupper, med forskjellig rolle i hver. Tilgang følger medlemskapet, ikke e-postdomenet. Klubbers og gruppers data skal være isolert fra hverandre.

## Produktkrav

### Klubber, grupper og felles innhold

- En konto kan opprette eller bli invitert til flere klubber.
- En klubb kan ha flere administratorer.
- Klubbadministrator kan invitere andre administratorer og fjerne administratorroller, inkludert sin egen. Den siste administratoren kan ikke fjernes før en annen har akseptert. Administratorrollen gir tilgang til alle klubbens grupper, men er separat fra gruppemedlemskap.
- En klubb kan ha flere undergrupper, for eksempel G2017.
- Når en gruppe opprettes, inviterer klubbadministrator en hovedtrener som gruppens første medlem. Hovedtreneren kan deretter administrere gruppen selvstendig, uten å være klubbadministrator.
- Hovedtrener kan invitere og fjerne trenere i egen gruppe, og administrere gruppens treningstider, planer, økter og delingsinnstillinger.
- Klubbadministratorer kan uavhengig av hovedtrener legge til og fjerne medlemmer i alle klubbens grupper. De kan også overføre hovedtrenerrollen eller invitere en ny hovedtrener.
- Ved overføring må mottakeren være et eksisterende medlem av samme gruppe. Overføringen utføres bare av klubbadministrator, og tidligere hovedtrener beholdes som vanlig trener. Rollebyttet og tilbakekalling av ubrukte hovedtrenerinvitasjoner gjøres atomisk.
- En gruppe har egne hovedtrenere/trenere, års-/periodeplan, kalender, økter og evalueringer.
- Klubben kan vedlikeholde innhold som deles med gruppene: sportsplan, trenerveiledning, utstyrsliste og andre dokumenter.
- Felles innhold skal versjoneres. En endring skal ikke i det stille endre en allerede godkjent eller gjennomført økt.
- Gruppens utstyrsbeholdning kan arve klubbens liste, med mulighet for lokale opplysninger og konkret tilgjengelighet per økt.

### Klubbprofil: temafarger og logo

- Klubbadministrator kan legge inn, endre og fjerne klubbens logo og temafarger, med primær- og aksentfarge.
- Klubbprofilen brukes på klubbens og undergruppenes sider, inkludert offentlige økt- og kalendersider. Endringer gjelder bare den aktuelle klubben.
- Vis en forhåndsvisning før lagring, og tilby tilbakestilling til løsningens standardprofil når logo eller farger ikke er satt.
- Fargeverdier valideres, og tekst, knapper og fokusmarkeringer skal beholde tilstrekkelig kontrast. Logo valideres for filtype og størrelse, og vises med et meningsfullt tekstalternativ.
- Trenere og hovedtrenere kan ikke endre klubbprofilen uten klubbadministratorrolle.
- Første implementasjon tillater statiske PNG-, JPEG- og WebP-logoer på maksimalt 512 KiB og 2048 × 2048 piksler. Serveren dekoder bildet, kontrollerer faktisk filtype og skalerer/omkoder til WebP på opptil 512 × 512 piksler uten opprinnelige metadata. SVG, animasjon og eksterne logo-URL-er avvises.
- Små normaliserte logoer lagres i klubbens databasepost. Lokal drift krever ingen ekstern lagringstjeneste, og løsningen skriver ikke opplastinger til Git eller Vercels midlertidige disk.
- Primærfargen brukes til lenker, knapper og fokusmarkering og må ha minst 4,5:1 kontrast mot både hvitt og sidens lyse bakgrunn. Aksentfargen får automatisk svart eller hvit tekst med minst 4,5:1 kontrast. Fargene valideres på serveren og begrenses til seks heksadesimale tegn.
- Forhåndsvisning lagrer ingenting. Administrator kan fjerne bare logoen ved lagring, eller lagre standardfarger og fjerne logoen samlet med eksplisitt tilbakestilling. Appens globale navigasjon beholdes nøytral.

### Innlogging og invitasjoner

- Bruk Neon Auth med e-postbasert magic link.
- Magic link er engangsbruk og har kort utløpstid. Innlogget økt varer vesentlig lenger, men varighet skal kunne konfigureres og tilbakekalles.
- Lokal utvikling skal bruke en egen lokal auth-adapter og ikke kreve Neon Auth-konto, Neon-tilkobling eller ekstern e-postutsending. Utviklingsflyten kan vise magic link lokalt, for eksempel i terminalen eller en lokal e-postfanger.
- Lokal auth er kun tilgjengelig i eksplisitt lokal utviklingsmodus og skal ikke kunne aktiveres i test- eller produksjonsmiljø.
- Invitasjoner er knyttet til klubb eller gruppe, rolle og mottaker. Klubbadministrator inviterer første hovedtrener til en gruppe; deretter kan hovedtrener invitere gruppetrenere. Klubbadministrator kan også invitere medlemmer direkte til enhver gruppe. Invitasjoner skal kunne utløpe, trekkes tilbake og aksepteres etter innlogging.
- Administratorinvitasjoner krever eksplisitt aksept fra innlogget mottaker med samsvarende e-postadresse. Lokalt varer de i sju dager, kan bare brukes én gang og erstattes ved ny invitasjon til samme mottaker. Fjerning av administrator tilbakekaller ubrukte administratorinvitasjoner til eller opprettet av personen, men bevarer selvstendige gruppemedlemskap.
- Brukeren skal tydelig se hvilken klubb og gruppe som er aktiv.
- Detaljer som utløpstid for magic link og innlogget økt må fastsettes ved implementering i tråd med Neon Auth sine støttede innstillinger.

### Kalender og periodeplan

- Trenere kan opprette en kalender for gruppen med treningsdatoer, tema og eventuelle læringsmål.
- Gruppen kan selv registrere én eller flere faste treningstider, med ukedag og klokkeslett. Trenere kan legge inn unntak eller enkeltøkter uten å endre den faste rytmen.
- Kalenderen viser planlagt tema, øktstatus og om et AI-utkast er klart; evaluering og interne notater er ikke synlige offentlig som standard.
- Planleggeren tar hensyn til tema og progresjon i års-/periodeplanen når den foreslår en økt.
- Gruppen angir standard varighet for treningene. En trener kan overstyre varighet for en enkelt økt uten å endre standardverdien.
- En trener kan endre dato, tema, varighet, antall spillere, antall trenere og andre rammer per økt uten å overskrive gruppens standardverdier.
- Kalenderen skal kunne deles offentlig med en skrivebeskyttet lenke. Treneren velger hvilke felt og datoer som inngår.
- Årsplanen har eksplisitt fødselsår, årsmål og daterte, ikke-overlappende temaperioder med øvingsmål og progresjon. Årskull skal ikke utledes fra gruppenavnet.
- NFFs [sportsplan/fagplan for barn og ungdom](https://www.fotball.no/barn-og-ungdom/) skal være standard faglig utgangspunkt for forslag til temaer og øvingsmål tilpasset alder i planåret. Automatisk forslag utsettes til AI i steg 4; nå tilrettelegges aldersbestemt kildelenke og strukturert kontekst, uten forhåndsutfylte NFF-temaer.
- Faste uketider kan projiseres virtuelt til kalenderen. En øktplan eller avlysning lagres først ved aktiv handling. En stabil forekomstnøkkel hindrer duplikater og at opprinnelig tidspunkt gjenoppstår etter flytting, også over årsskiftet. Endrede uketider endrer ikke allerede lagrede økter.
- Kalenderdato og treningstid lagres som lokale verdier i `Europe/Oslo`; senere automatikk må håndtere sommertid ved beregning av kjøretidspunkt.

### Planlegging og AI-agent

Agenten bruker Vercel AI Gateway og skal kunne:

1. Lage et øktutkast for valgt gruppe og dato.
2. Se på tilgjengelig historikk og evalueringer, års-/periodeplan, klubbens felles veiledning og sportsplan, tema i kalenderen og øktens praktiske rammer.
3. Bruke agentens nettleser til å åpne og undersøke offentlig tilgjengelige Tiim-sider for relevante øvelser, vise kildelenke og oppgi aldersmerking når den er kontrollert.
4. Fordele spillere i grupper og beskrive organisering, trenerroller, rotasjon, mål og samtidig ballbehov ut fra oppgitt spiller- og trenerantall.
5. Forklare viktige valg, vise antakelser og varsle når informasjon mangler eller forutsetninger ikke går opp.
6. Revidere et eksisterende utkast etter en trenerprompt, uten å fjerne godkjent plan eller tidligere evaluering.

AI-forslag er alltid utkast. En trener må kontrollere og godkjenne før økten får status som planlagt eller deles. Agenten skal ikke finne på gjennomførte økter, oppmøte, utstyrstall, evalueringer, aldersmerking eller kildelenker. Tiim undersøkes via nettleser mot offentlig tilgjengelige sider, og agenten registrerer den faktiske lenken og hva den fikk kontrollert. Nettleserbruken skal følge Tiims tilgangsvilkår og ikke omgå innlogging, tekniske begrensninger eller andre tilgangskontroller. Ikke kopier beskyttet innhold; bruk lenke og kort, nødvendig kildebeskrivelse. Hvis en side ikke kan åpnes eller relevant informasjon ikke kan bekreftes, skal agenten si dette tydelig i stedet for å gjette.

Hvert utkast skal vise hvilke kilder og historiske økter som påvirket forslaget, og skille mellom kildefakta, brukeropplysninger og planforutsetninger. En trener skal kunne åpne kildene fra øktvisningen.

### Økter, redigering og evaluering

- Øktplan kan redigeres manuelt eller med en instruks til AI-agenten.
- Lagre versjoner av utkast og godkjent plan. Redigering skal ikke slette tidligere versjoner.
- En økt kan inneholde mål, tidsplan, øvelseskort, grupper, trenerroller, utstyrsbehov, Tiim-kilder, lokale tilpasninger og medier.
- Manuell øktbygger bruker Tiim-inspirert struktur: tema/introduksjon, øvingsmål og rammer, deretter ordnede kort for oppvarming, temaarbeid, spill og avslutning. Hvert kort har varighet, mål, organisering/rotasjon, instruksjon, læringsmomenter, enklere/vanskeligere variant, kilde og lokale tilpasninger. Dette er egne beskrivelser, ikke kopiert Tiim-innhold.
- Samme versjonerte, validerte plankontrakt skal brukes av manuell redigering og senere AI. Hver planversjon bevarer øktmetadata, planstatus og årsplankontekst; endringer i årsplanen skal ikke endre eksisterende planer i det stille. Utdaterte redigeringer avvises fremfor å overskrive en annen treners arbeid.
- Kontroller at tidsplanen summerer til oppgitt øktlengde, og at samtidige grupper, mål og baller er regnet med. Vis tydelig varsel ved manglende data eller avvik, ikke en falsk grønn status.
- Ukjente ressursantall lagres som ukjente, ikke null baller eller én ball per spiller. Hvert øvelseskort er en sekvensiell blokk med samlet fordeling og behov for alle samtidige grupper; toppbehov mellom blokker sammenlignes med bekreftet beholdning. Reserveballer inngår i behovet. Trener må fortsatt kontrollere sikkerhet og praktisk organisering.
- Ufullstendige utkast kan lagres, men kan ikke godkjennes. Redigering av en planlagt økt krever eksplisitt ny godkjenning, ellers blir den utkast. Avlysning/gjenåpning bevarer planversjonene, og gjenåpning gir ikke automatisk godkjenning.
- Etter trening kan trener registrere faktisk oppmøte på gruppenivå, faktisk gjennomførte øvelser, endringer og evaluering. Plan og faktisk gjennomføring lagres hver for seg.
- Evalueringer skal være tilgjengelige som kontekst for senere planlegging, men være private for gruppens autoriserte trenere og administratorer.
- Status minst: `utkast`, `planlagt`, `gjennomført` og `avlyst`. `Gjennomført` krever registrert gjennomføring; delingsstatus er en separat egenskap.
- Historikkvisning skal kunne filtreres på dato, tema, status og øvelse, og gjøre det enkelt å finne tidligere økter med samme tema.

### Automatisk utkast

- En gruppe kan slå automatisk generering av utkast av eller på.
- Gruppen angir treningstidene sine, standard øktvarighet og hvor mange dager før en trening et utkast skal opprettes automatisk dersom ingen økt allerede er opprettet manuelt.
- Eksempel: Gruppen trener onsdag kl. 18 og setter automatisk oppretting til tre dager før. Hvis ingen økt finnes for onsdagen når fristen nås, oppretter systemet ett AI-utkast basert på kalender, periodeplan, historikk og evalueringer.
- Gruppen kan også angi hvor mange sammenhengende treninger en plan eller progresjonsblokk skal gjelde. Dette er separat fra lengden på hver treningsøkt.
- Automatisk generering oppretter bare et utkast. Den skal aldri godkjenne, publisere eller sende ut en offentlig lenke uten menneskelig handling.
- Jobben skal kjøre for gruppens lokale treningstid og være idempotent: ikke opprett et duplikatutkast dersom trener allerede har opprettet en økt for samme trening, eller dersom jobben kjører flere ganger. Feil og manglende grunnlagsdata vises for treneren og kan forsøkes på nytt.
- Trenerne kan pause automatiseringen, endre innstillinger og be om et utkast manuelt.

### Offentlig deling og medier

- Hver godkjente økt kan få en separat, tilfeldig og tilbakekallbar offentlig lenke uten automatisk utløpstid. Lenken gir kun lesetilgang til den delte økten og virker til den tilbakekalles manuelt.
- Kalenderdeling er separat, har heller ingen automatisk utløpstid og er avgrenset til eksplisitt valgte datoer og felter. Evalueringer, interne kommentarer, invitasjoner og medlemsdata skal aldri inngå i offentlig visning.
- Delte sider skal kunne åpnes uten konto. Klubb eller gruppe kan tilbakekalle deling når som helst.
- Offentliggjøring skal vise øktinnhold, ikke opplysninger om enkeltbarn. Spillerantall kan vises bare aggregert og etter trenerens valg.
- Medier støtter bilder, video og animasjoner. Eksterne innbygginger begrenses til godkjente leverandører; vis alltid en vanlig kildelenke som reserve.
- Ikke kopier eller last opp eksterne videoer uten rettigheter. Bruk lenke eller tillatt innebygging og ta hensyn til personvern og samtykke ved opptak.
- Eksisterende taktikktavler bruker JSON med objekter og animerte steg, og har en visuell redigerer. Integrer redigereren i Next.js-appen, gjenbruk dagens JSON-format og bevar eksisterende funksjoner for oppretting, åpning, redigering og eksport. Behold tekstlig øvelsesbeskrivelse, avspilling på brukerens initiativ og støtte for redusert bevegelse.
- MVP kan lagre små animasjonsdata i Neon og bruke eksterne videolenker; egen videolagring er utenfor første leveranse.

## Viktige brukerreiser

1. **Opprette klubb:** bruker logger inn, oppretter klubb, legger til administratorer, oppretter grupper og registrerer felles sportsplan, veiledning og utstyr.
2. **Starte gruppe:** klubbadministrator oppretter gruppe og inviterer hovedtrener som første medlem. Hovedtrener aksepterer med magic link og kan invitere gruppens øvrige trenere.
3. **Administrere gruppemedlemmer:** hovedtrener inviterer eller fjerner trenere i egen gruppe. Klubbadministrator kan også legge til eller fjerne medlemmer i alle grupper.
4. **Planlegge økt:** trener velger dato og tema i kalenderen, oppgir antall spillere/trenere og rammer, genererer AI-utkast, kontrollerer kilder og utstyrsregnskap, redigerer og godkjenner.
5. **Gjennomføre og lære:** trener registrerer faktisk gjennomføring og evaluering etter økten. Agenten kan bruke dette ved neste forslag.
6. **Dele:** trener velger økt eller kalenderinnhold, forhåndsviser offentlig side og oppretter en lenke uten automatisk utløp. Lenken kan kopieres og tilbakekalles.
7. **Automatisere:** trener konfigurerer treningstidene, øktvarighet og antall dager før trening. Hvis ingen økt er opprettet manuelt innen fristen, systemet lager ett utkast og venter på godkjenning.

## Foreslått datamodell

Tabellene implementeres med Drizzle og Neon Postgres. Dette er logiske objekter; eksakt normalisering og kolonnenavn fastsettes i databasemigrasjonene.

| Objekt | Innhold og relasjoner |
| --- | --- |
| `users` / auth-identiteter | Neon Auth-identitet og visningsopplysninger |
| `clubs` | Klubb og innstillinger |
| `club_memberships` | Bruker, klubb, rolle og medlemsstatus |
| `groups` | Undergruppe tilhørende klubb, eksempelvis G2017 |
| `group_memberships` | Bruker, gruppe, rolle (`head_coach` eller `coach`) og status |
| `club_documents` | Sportsplan, veiledning og annet klubbfelles innhold med versjoner |
| `equipment` | Klubbens utstyr og eventuelle gruppejusteringer |
| `group_plans` | Års-/periodeplan og tema/progresjon |
| `training_series` | Faste treningstider, standard øktvarighet, dager før automatisk oppretting, blokkvarighet og automatiseringsinnstillinger |
| `sessions` | Dato, tema, status, varighet, spiller-/trenerantall og rammer |
| `session_versions` | Uforanderlige planversjoner, AI-/manuell opprinnelse og godkjenning |
| `session_activities` | Tidsplan, grupper, øvelser, roller og utstyrsbehov per versjon |
| `sources` | Tiim-/eksterne lenker, kildetype, aldersmerking og kontrolltidspunkt |
| `evaluations` | Faktisk gjennomføring og evaluering knyttet til økt og gruppe |
| `media` | Tillatte medielenker eller taktikktavle-JSON knyttet til øktversjon |
| `public_shares` | Hash av hemmelig delingstoken, innholdsomfang og tilbakekalling; ingen automatisk utløpstid |
| `generation_jobs` | Automatiske/manuelle genereringsjobber, status og feilinformasjon |

Hver tenant-eid rad må ha klubbtilknytning. Gruppeinnhold må i tillegg være bundet til riktig gruppe. Bruk sammensatte fremmednøkler eller tilsvarende databasebegrensninger for å hindre at en referanse peker på en gruppe fra en annen klubb.

Den lokale planleggingsleveransen bruker `annual_plans`, `plan_periods`, `training_events` og `session_versions`. Øvelseskort, ressursforutsetninger og kildefelt ligger foreløpig i validert, versjonert JSON per planversjon. Årsplankontekst lagres som snapshot sammen med versjonen, inkludert NFF-kildelenke og markering av at AI-forslag ennå ikke er aktive. Senere AI-integrasjon må bruke samme validering og versjonering, og hente faktisk historikk, evalueringer og klubbfelles innhold når disse er implementert.

## Teknisk løsningsretning

- **Web:** Next.js med TypeScript og HeroUI-komponenter med Tailwind CSS. Autorisasjon og datatilgang håndteres server-side.
- **Database:** Neon Postgres i deployede miljøer og PGlite som standard lokalt, med samme Drizzle-skjema og SQL-migrasjoner. PGlite kjører innebygd i Node.js og lagrer utviklingsdata på disk uten Docker eller egen databaseserver.
- **Lokal oppstart:** `dev`-oppstartsskriptet åpner PGlite, kjører ventende Drizzle-migreringer, lukker forbindelsen og starter deretter Next.js. Fillås hindrer samtidige prosesser i å åpne samme PGlite-mappe. Appen deler én instans mellom forespørsler.
- **Migreringer i deploy:** produksjonsmigrering kjøres som et eget kontrollert deploy-steg mot Neon, ikke som sideeffekt av hver Vercel-funksjonsstart. Samme versjonerte Drizzle-migreringer brukes lokalt og i deploy.
- **Auth:** Neon Auth magic link og langvarig, tilbakekallbar innlogget økt i deployede miljøer. Auth-laget abstraheres slik at lokal utvikling bruker lokal auth-adapter med samme bruker-/rollegrensesnitt uten å koble til Neon Auth.
- **AI:** Vercel AI Gateway; modell- og verktøytilgang styres fra serveren. API-nøkler og hemmeligheter lagres i miljø-/secret management, aldri i klientkode eller databaseinnhold.
- **Hosting og automatisering:** Next.js-appen hostes på Vercel. Bruk planlagte Vercel-jobber eller en tilsvarende driftssikker scheduler til å opprette utkast før gruppens treningstid; jobbstatus lagres i databasen, og jobben må tåle gjentatte kjøringer.
- **Deling:** offentlig leserute med token som verifiseres server-side. Lagre bare hash av delingstoken. Token gir aldri tilgang til innloggede funksjoner og utløper ikke automatisk; tilgang kan tilbakekalles.
- **Medier:** responsiv, tilgjengelig avspilling og en streng tillatelsesliste for innbygginger. Eksisterende animasjonsformat behandles som data og valideres før visning.

## Lokal utvikling

- En utvikler skal kunne klone prosjektet og kjøre appens grunnleggende funksjoner med PGlite uten Docker, ekstern database, Neon Auth-konto eller ekstern e-posttjeneste.
- PGlite bruker Postgres-dialekt og samme versjonerte SQL-migreringer som Neon. Lokal database har persistent lagring i en Git-ignorert mappe og kan opprettes fra en tom tilstand med migreringene. Forskjeller i server-/tilkoblingsoppførsel må fortsatt testes mot Neon før produksjon.
- Oppstartsrekkefølge: åpne PGlite med eksklusiv fillås → kjør ventende Drizzle-migreringer → lukk forbindelsen → start Next.js. Oppstart skal feile tydelig hvis migrering eller databaseåpning feiler; ikke start appen med et utdatert skjema.
- Migreringskommandoen skal være tilgjengelig separat for CI og lokal feilsøking. Migreringer er versjonerte og kjøres bare én gang per databaseversjon, også om utvikleren starter appen på nytt.
- Lokal auth skal gjøre det mulig å teste magic-link- og invitasjonsflyten uten å sende e-post ut av maskinen. Testlenke kan vises i lokal e-postfanger eller terminal, men må være tydelig merket som utviklingsmodus.
- Lokal auth må kreve eksplisitt utviklingskonfigurasjon og nekte å starte hvis aktivt miljø er test eller produksjon. Produksjonsdeploy skal kreve Neon Auth-konfigurasjon og skal aldri falle tilbake til lokal auth automatisk.
- Oppstartsinstruksjoner og nødvendige lokale miljøvariabler skal dokumenteres i prosjektets README eller `.env.example`; ikke legg hemmeligheter eller produksjonsdata i repoet.

## Sikkerhet, personvern og kvalitet

- Alle innloggede lese- og skriveoperasjoner autoriseres server-side mot aktivt medlemskap og rett rolle. Skjulte knapper i brukergrensesnittet er ikke tilgangskontroll.
- Tenant-filter skal inngå i alle databaseoperasjoner. Test eksplisitt at bruker i klubb A ikke kan lese eller endre klubb B sine data ved å endre ID i en forespørsel.
- Ikke lag spillerprofiler eller lagre navn på enkeltbarn i MVP. Bruk gruppenivå og aggregerte tall; ikke send identifiserende personopplysninger til AI Gateway.
- Offentlige visninger bruker en tillatelsesliste med felter, ikke en filtrering som forsøker å fjerne interne data etter at hele øktobjektet er hentet.
- Delingstokener må være uforutsigbare, kunne tilbakekalles og ikke logges i klartekst. Offentlige lenker utløper ikke automatisk, og treneren skal kunne forhåndsvise delingen.
- Valider eksterne URL-er og tillatte iframe-leverandører for å redusere XSS og innbyggingsmisbruk. Ikke render vilkårlig HTML fra AI- eller kildeinnhold.
- Logg viktige administrative endringer, invitasjoner, godkjenning, deling og AI-generering uten å logge magic links, tokens eller unødvendig evalueringsinnhold.
- Bruk versjonering og tydelig feilhåndtering ved AI-, database- og schedulerfeil. Ufullstendige forslag skal aldri se ut som ferdige eller publiserte økter.
- Grensesnittet skal fungere på mobil, være tastaturnavigerbart og oppgi tekstalternativ til visuelle øvelser og animasjoner.

## MVP og avgrensning

**MVP omfatter:** klubber og grupper, invitasjon av hovedtrener som første gruppemedlem, gruppeadministrasjon for hovedtrener, klubbadministrasjon av gruppemedlemskap, magic link, lokal utviklingsmodus med PGlite og lokal auth uten Docker-/Neon-avhengighet, HeroUI-grensesnitt, klubbfelles innhold, gruppekalender og periodeplan, manuell øktplanlegging, AI-utkast og promptbasert revisjon, historikk/evaluering, utstyrs- og grupperegnskap, valgfri automatisk utkastjobb, offentlige skrivebeskyttede lenker og visning av støttede medier/taktikktavler.

**Ikke del av MVP:** spillerkontoer eller individuelle profiler, kampadministrasjon, betaling, automatisk publisering, egen videohosting, ubegrensede eksterne iframe-kilder og en uautorisert direkteintegrasjon mot Tiim. Taktikkredigereren integreres i Next.js-appen ved å gjenbruke eksisterende format og funksjoner, ikke ved å bygge en separat ny redigerer fra grunnen.

## Akseptansekriterier

1. En bruker kan tilhøre to klubber og bare se data for klubber/grupper der brukeren har aktivt medlemskap.
2. Klubbadministrator kan legge til en annen administrator, opprette en gruppe og invitere hovedtrener som første gruppemedlem.
3. Hovedtrener kan invitere og fjerne trenere i egen gruppe; klubbadministrator kan legge til og fjerne gruppemedlemmer i alle klubbens grupper.
4. En trener kan lage et AI-utkast der dato, tema, gruppeplan, relevant historikk/evaluering, spillerantall, trenerantall og utstyr er synlig brukt eller eksplisitt merket som manglende.
5. Utkastet viser kildelenker og kontrollert aldersmerking når det er tilgjengelig, og viser manglende kildegrunnlag uten å dikte opp opplysninger.
6. Planen viser tidsregnskap og samtidig behov for grupper, trenere, mål og baller; avvik og ukjente tall får synlige varsler.
7. Manuell redigering og AI-revisjon oppretter ny versjon og bevarer tidligere godkjent plan og evaluering.
8. Gruppens faste treningstid, standard varighet og antall dager før økten styrer automatisk utkast. Et manuelt opprettet utkast hindrer duplikat, og automatiseringen publiserer aldri av seg selv.
9. Evaluering etter trening påvirker senere forslag uten at den blir synlig i offentlig deling.
10. En offentlig øktlenke viser bare valgte, godkjente treningsopplysninger uten innlogging. Lenken er skrivebeskyttet, har ingen automatisk utløpstid og slutter å virke etter tilbakekalling.
11. En offentlig kalenderlenke viser bare valgte datoer/felter; ingen evalueringer, invitasjoner eller medlemsdata.
12. Eksisterende taktikktavle-JSON kan vises med tekstalternativ, og animasjon starter først etter en aktiv handling fra leseren.
13. Sikkerhetstester verifiserer klubb- og gruppeskille for både lesing, endring og delte lenker, inkludert rollegrensene mellom klubbadministrator, hovedtrener og trener.
14. En utvikler kan starte lokal app med diskbasert PGlite uten Docker, Neon-tilkobling eller Neon Auth. Lokal oppstart anvender ventende Drizzle-migreringer før Next.js starter, og lagrede data beholdes ved omstart.
15. Lokal magic-link- og invitasjonsflyt fungerer uten ekstern e-postutsending; lokal auth kan ikke aktiveres i deployede test- eller produksjonsmiljøer.
16. Deploy kjører migreringer kontrollert mot Neon uten at migreringer startes på nytt for hver Vercel-funksjonsinstans.
17. Klubbadministrator kan lagre logo og temafarger med forhåndsvisning. Profilen vises på klubbens, gruppenes og klubbens offentlige sider uten å påvirke andre klubber, og løsningen har tilgjengelige kontraster og standardprofil som reserve.
18. Eksisterende sider bruker HeroUI for kort, knapper, lenker, tekst-/tallfelt og ukedagsvalg, med tilgjengelige etiketter, validering og uendret server-side tilgangskontroll.

## Avklaringer før implementering

- Hvor lang skal en innlogget økt vare, og skal den kunne huskes på en privat enhet?
- Skal kalenderen støtte én fast ukentlig treningsdag, flere dager eller frie datoer?
- Hvordan skal trenerne varsles når et automatisk utkast er opprettet?
- Hvilken e-postleverandør, hvilket domene og hvilken miljøinndeling (utvikling/test/produksjon) skal brukes med Vercel og Neon?
