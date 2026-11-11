# Spesifikasjon: digital løsning for klubbøkter

## Status og formål

Dette dokumentet beskriver ønsket produkt og teknisk retning for en nettbasert løsning for planlegging, gjennomføring og deling av fotballøkter. Det er en kravspesifikasjon, ikke dokumentasjon på at funksjonene allerede er bygget.

Løsningen skal hjelpe flere klubber og trenerteam med å lage praktiske, varierte økter basert på klubbens sportsplan, lagets periodeplan, tidligere evalueringer, oppmøte, trenere og tilgjengelig utstyr. Trenere skal kunne bruke både manuell redigering og AI-støtte. Ferdige økter og utvalgte kalendere skal kunne deles som lesbare sider uten innlogging.

## Brukere og tilgang

| Rolle | Tilgang |
| --- | --- |
| Klubbadministrator | Administrere klubb, klubbadministratorer, lag, felles sportsplan, veiledning, utstyr og invitasjoner |
| Hovedtrener | Lagets administrator. Administrere lagets medlemmer og innstillinger, treningstider, planer, økter og deling; lese klubbens felles innhold |
| Trener | Tilgang til lag vedkommende er invitert til; lese klubbens felles innhold, planlegge og redigere økter, bruke AI, registrere evaluering og administrere deling innenfor lagets regler |
| Offentlig leser | Se kun økter eller kalenderinnhold som er eksplisitt delt med en aktiv, skrivebeskyttet lenke |

En bruker kan være medlem av flere klubber og lag, med forskjellig rolle i hver. Tilgang følger medlemskapet, ikke e-postdomenet. Klubbers og lags data skal være isolert fra hverandre.

## Produktkrav

### Klubber, lag og felles innhold

- En konto kan opprette eller bli invitert til flere klubber.
- En klubb kan ha flere administratorer.
- Klubbadministrator kan invitere andre administratorer og fjerne administratorroller, inkludert sin egen. Den siste administratoren kan ikke fjernes før en annen har akseptert. Administratorrollen gir tilgang til alle klubbens lag, men er separat fra lagmedlemskap.
- En klubb kan ha flere lag, for eksempel G2017.
- Klubb og lag har stabile slugs generert fra navn: `/{klubb}/{lag}/okter/{økt-id}` og `/{klubb}/{lag}/aarsplan`. Klubbslug er unik globalt, lagslug innen klubben. Norske bokstaver normaliseres og reserverte navn/navnekollisjoner får unike suffikser. Slugs endres ikke automatisk med navn. Alle oppslag kontrollerer klubbtilhørighet og medlemskap; en slug er ikke en delingslenke eller tilgangsnøkkel.
- Eksisterende ID-baserte adresser videresendes med søkeparametere bevart etter tilgangskontroll. Navigasjon, skjemaresultater, kalender og animasjonseditor skal bruke slugadressene. Migreringen bevarer ID-er, medlemskap og historikk.
- Når et lag opprettes, inviterer klubbadministrator en hovedtrener som lagets første medlem. Hovedtreneren kan deretter administrere laget selvstendig, uten å være klubbadministrator.
- Hovedtrener kan invitere og fjerne trenere på eget lag, og administrere lagets treningstider, planer, økter og delingsinnstillinger.
- Klubbadministratorer kan uavhengig av hovedtrener legge til og fjerne medlemmer i alle klubbens lag. De kan også overføre hovedtrenerrollen eller invitere en ny hovedtrener.
- Ved overføring må mottakeren være et eksisterende medlem av samme lag. Overføringen utføres bare av klubbadministrator, og tidligere hovedtrener beholdes som vanlig trener. Rollebyttet og tilbakekalling av ubrukte hovedtrenerinvitasjoner gjøres atomisk.
- Et lag har egne hovedtrenere/trenere, års-/periodeplan, kalender, økter og evalueringer.
- Trenere registreres på et lag med navn og valgfri e-postadresse, uavhengig av brukerkonto og app-tilgang. Hovedtrener og klubbadministrator kan registrere, redigere og fjerne trenere. Trenere uten konto skal kunne velges og telles i øktplanlegging; registrering alene gir aldri tilgang.
- E-post kan legges til senere og brukes til en eksplisitt app-invitasjon. Aksept krever riktig innlogget e-post og kobler kontoen til samme treneroppføring uten å endre trener-ID i øktplaner. Ny invitasjon erstatter tidligere ubrukte trenerinvitasjoner; endring av e-post før aksept trekker tilbake gamle invitasjoner. Etter aksept er e-post bundet til kontoen. Fjerning av trener tilbakekaller lagtilgang og ubrukte invitasjoner, uten å endre historiske øktversjoner.
- Klubben kan vedlikeholde innhold som deles med lagene: sportsplan, trenerveiledning, utstyrsliste og andre dokumenter.
- Sportsplan har en egen meny på klubb- og lagsider. Trenere kan lese Markdown og uttrukket tekst fra PDF og Word samt laste ned aktive dokumenter; bare klubbadministrator kan laste opp og arkivere dokumenter eller opprette og redigere Markdown. Tidligere versjoner arkiveres ved redigering, og samtidige redigeringer avvises.
- Felles innhold skal versjoneres. En endring skal ikke i det stille endre en allerede godkjent eller gjennomført økt.
- Lagets utstyrsbeholdning kan arve klubbens liste, med mulighet for lokale opplysninger og konkret tilgjengelighet per økt.

### Klubbprofil: temafarger og logo

- Klubbadministrator kan legge inn, endre og fjerne klubbens logo og temafarger, med primær- og aksentfarge.
- Klubbprofilen brukes på klubbens og lagenes sider, inkludert offentlige økt- og kalendersider. Endringer gjelder bare den aktuelle klubben.
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
- Invitasjoner er knyttet til klubb eller lag, rolle og mottaker. Klubbadministrator inviterer første hovedtrener til et lag; deretter kan hovedtrener invitere lagtrenere. Klubbadministrator kan også invitere medlemmer direkte til ethvert lag. Invitasjoner skal kunne utløpe, trekkes tilbake og aksepteres etter innlogging.
- Administratorinvitasjoner krever eksplisitt aksept fra innlogget mottaker med samsvarende e-postadresse. Lokalt varer de i sju dager, kan bare brukes én gang og erstattes ved ny invitasjon til samme mottaker. Fjerning av administrator tilbakekaller ubrukte administratorinvitasjoner til eller opprettet av personen, men bevarer selvstendige lagmedlemskap.
- Brukeren skal tydelig se hvilken klubb og hvilket lag som er aktivt.
- Detaljer som utløpstid for magic link og innlogget økt må fastsettes ved implementering i tråd med Neon Auth sine støttede innstillinger.

### Årsplan, månedsvisning og periodeplan

- Årsplanen samler treningsdatoer, temaer og læringsmål i en månedsvisning. En separat kalenderside skal ikke vises; gamle kalenderadresser videresendes til årsplanen med år/måned bevart.
- Lagets trenere og klubbadministratorer kan legge til, redigere og fjerne cup, ferie/fridag og andre heldagshendelser med tittel, fra-/til-dato og valgfri beskrivelse. Hendelser kan krysse måned-/årsskifter og krever ikke en lagret årsplan. De avlyser ikke treninger automatisk; avlysning er en eksplisitt handling på enkelttreningen.
- Laget kan selv registrere én eller flere faste treningstider, med ukedag, fra-tid og til-tid. Trenere kan legge inn unntak eller enkeltøkter uten å endre den faste rytmen.
- Kalenderen viser planlagt tema, øktstatus og om et AI-utkast er klart; evaluering og interne notater er ikke synlige offentlig som standard.
- Planleggeren tar hensyn til tema og progresjon i års-/periodeplanen når den foreslår en økt.
- Hver økt må ha fra- og til-tidspunkt. Varigheten beregnes fra tidsrommet og kan ikke angis uavhengig. Ved oppretting for en bestemt trening hentes tidene og dermed øktlengden automatisk fra denne treningstiden på serveren. Laget skal ikke ha en felles standardvarighet i innstillingene.
- En trener kan endre dato, fra-/til-tid, tema, antall spillere, antall trenere og andre rammer per økt uten å overskrive lagets faste treningstider. Enkeltøkter krever egne fra-/til-tider. Tidsrom må være 15–240 minutter; tidligere til-tid betyr neste dag, mens identiske tider er ugyldige.
- Kalenderen skal kunne deles offentlig med en skrivebeskyttet lenke. Treneren velger hvilke felt og datoer som inngår.
- Årgang (for eksempel 2017) er en valgfri innstilling på laget, ikke på årsplanen. Klubbadministrator kan sette den ved oppretting, og hovedtrener eller klubbadministrator kan endre den i laginnstillingene. Årgang skal ikke utledes fra lagnavnet. Alder beregnes fra lagets årgang og valgt planår, også uten en lagret årsplan.
- Årsplanen har årsmål og daterte, ikke-overlappende temaperioder med øvingsmål og progresjon. Nye øktversjoner tar et snapshot av lagets årgang; endringer skal ikke overskrive historisk årsplankontekst. Ved migrering overføres bare entydige eksisterende årsplanverdier, og konflikter krever eksplisitt avklaring i laginnstillingene. De tidligere årsplanverdiene bevares.
- NFFs [sportsplan/fagplan for barn og ungdom](https://www.fotball.no/barn-og-ungdom/) skal være standard faglig utgangspunkt for forslag til temaer og øvingsmål tilpasset alder i planåret. Automatisk forslag utsettes til AI i steg 4; nå tilrettelegges aldersbestemt kildelenke og strukturert kontekst, uten forhåndsutfylte NFF-temaer.
- Faste uketider kan projiseres virtuelt til kalenderen. En øktplan eller avlysning lagres først ved aktiv handling. En stabil forekomstnøkkel hindrer duplikater og at opprinnelig tidspunkt gjenoppstår etter flytting, også over årsskiftet. Endrede uketider endrer ikke allerede lagrede økter.
- Kalenderdato og treningstid lagres som lokale verdier i `Europe/Oslo`; senere automatikk må håndtere sommertid ved beregning av kjøretidspunkt.

### Planlegging og AI-agent

Agenten bruker Vercel AI Gateway og skal kunne:

1. Lage et øktutkast for valgt lag og dato.
2. Se på tilgjengelig historikk og evalueringer, års-/periodeplan, klubbens felles veiledning og sportsplan, tema i kalenderen og øktens praktiske rammer.
3. Bruke agentens nettleser til å åpne og undersøke offentlig tilgjengelige Tiim-sider for relevante øvelser, vise kildelenke og oppgi aldersmerking når den er kontrollert.
4. Fordele spillere i lag og beskrive organisering, trenerroller, rotasjon, mål og samtidig ballbehov ut fra oppgitt spiller- og trenerantall.
5. Forklare viktige valg, vise antakelser og varsle når informasjon mangler eller forutsetninger ikke går opp.
6. Revidere et eksisterende utkast etter en trenerprompt, uten å fjerne godkjent plan eller tidligere evaluering.

AI-forslag er alltid utkast. En trener må kontrollere og godkjenne før økten får status som planlagt eller deles. Agenten skal ikke finne på gjennomførte økter, oppmøte, utstyrstall, evalueringer, aldersmerking eller kildelenker. Tiim undersøkes via nettleser mot offentlig tilgjengelige sider, og agenten registrerer den faktiske lenken og hva den fikk kontrollert. Nettleserbruken skal følge Tiims tilgangsvilkår og ikke omgå innlogging, tekniske begrensninger eller andre tilgangskontroller. Ikke kopier beskyttet innhold; bruk lenke og kort, nødvendig kildebeskrivelse. Hvis en side ikke kan åpnes eller relevant informasjon ikke kan bekreftes, skal agenten si dette tydelig i stedet for å gjette.

Hvert utkast skal vise hvilke kilder og historiske økter som påvirket forslaget, og skille mellom kildefakta, brukeropplysninger og planforutsetninger. En trener skal kunne åpne kildene fra øktvisningen.

#### Første implementerte agent

- Vercel AI SDK `ToolLoopAgent`, Gateway-provider og `@ai-sdk/react` (AI SDK UI) brukes til streaming-chat i øktredigeringen. Chatten er en sidestolpe på brede skjermer og ligger over skjemaet på mobil; den kan foldes sammen.
- Serveren kontrollerer innlogging, lagtilgang, økttilhørighet, avlysningsstatus og revisjon før modellen får kontekst. Den leser gjeldende usparte økt, årsplan/temaperioder/hendelser for redigert dato og fem tidligere planer fra samme lag. Medlems-/kontoopplysninger og andre lags data inngår ikke.
- Agentens verktøy kan lese denne konteksten og foreslå en komplett plan. De kan ikke skrive til databasen. Bekreftet oppmøte/utstyr og dato/tid bevares; tidsplanen valideres mot faktisk øktlengde og samtidig ressursbehov.
- Treneren ser øvelser og kontrollpunkter før **Bruk forslaget i skjemaet** erstatter tittel, tema, øvingsmål og planen. Forslag basert på et endret skjema avvises. Eksisterende lagring/godkjenning er fortsatt eksplisitt og oppretter en ny uforanderlig versjon med innlogget aktør og AI-assistert opprinnelse.
- `AI_GATEWAY_API_KEY` er server-only, med valgfri `AI_MODEL` i Gateway-format. Manglende konfigurasjon og modell-/strømmefeil vises tydelig; manuell redigering fortsetter å fungere.
- Chat/kontekst, inkludert uttrukket tekst fra aktive klubbdokumenter, sendes til Vercel AI Gateway/modellleverandøren og må bare inneholde treningsinnhold. Chatten lagres ikke. Første versjon har ingen Tiim-nettleser, faktisk evaluering eller tidsstyrt generering. Kildeopplysninger fra tidligere planer er ikke ny verifisering.
- Første agent har fire modellsteg og 110 sekunders tidsgrense per melding, avgrenset forespørsels-/chatstørrelse og seks forespørsler per bruker/minutt per prosess. Delt ratebegrensning/kostnadsbudsjett kreves før flerinstans-produksjon.

### Økter, redigering og evaluering

- Øktplan kan redigeres manuelt eller med en instruks til AI-agenten.
- Lagre versjoner av utkast og godkjent plan. Redigering skal ikke slette tidligere versjoner.
- Alle lagrede endringer i økter, årsplaner og periodeplaner skal ha en uforanderlig endringshistorikk som viser **hvem som endret**, **når** og **hva som ble endret**, med tidligere og nye verdier eller referanser til bevarte versjoner. Dette omfatter også oppretting, sletting av perioder, flytting, godkjenning, avlysning og gjenåpning.
- Endringsaktør hentes fra innlogget bruker på serveren, ikke fra et redigerbart skjemafelt. Ved AI-revisjoner registreres både AI-opprinnelse og brukeren som ba om eller godkjente endringen; automatiske jobber merkes som systemhandlinger. Historikk lagres atomisk sammen med endringen og bevares også når en bruker mister tilgang.
- Autoriserte trenere og klubbadministratorer skal kunne åpne endringshistorikken fra økten eller planen. Brukeridentitet og intern endringshistorikk skal ikke vises via offentlige delingslenker.
- En økt kan inneholde mål, tidsplan, øvelseskort, lag, trenerroller, utstyrsbehov, Tiim-kilder, lokale tilpasninger og medier.
- Manuell øktbygger bruker Tiim-inspirert struktur: tema/introduksjon, øvingsmål og rammer, deretter ordnede kort for oppvarming, temaarbeid, spill og avslutning. Hvert kort har varighet, mål, organisering/rotasjon, instruksjon, læringsmomenter, enklere/vanskeligere variant, kilde og lokale tilpasninger. Dette er egne beskrivelser, ikke kopiert Tiim-innhold.
- Samme versjonerte, validerte plankontrakt skal brukes av manuell redigering og senere AI. Hver planversjon bevarer øktmetadata, planstatus og årsplankontekst; endringer i årsplanen skal ikke endre eksisterende planer i det stille. Utdaterte redigeringer avvises fremfor å overskrive en annen treners arbeid.
- Kontroller at tidsplanen summerer til oppgitt øktlengde, og at samtidige grupper, mål og baller er regnet med. Vis tydelig varsel ved manglende data eller avvik, ikke en falsk grønn status.
- Ukjente ressursantall lagres som ukjente, ikke null baller eller én ball per spiller. Hvert øvelseskort er en sekvensiell blokk med samlet fordeling og behov for alle samtidige grupper; toppbehov mellom blokker sammenlignes med bekreftet beholdning. Reserveballer inngår i behovet. Trener må fortsatt kontrollere sikkerhet og praktisk organisering.
- Ufullstendige utkast kan lagres, men kan ikke godkjennes. Redigering av en planlagt økt krever eksplisitt ny godkjenning, ellers blir den utkast. Avlysning/gjenåpning bevarer planversjonene, og gjenåpning gir ikke automatisk godkjenning.
- Etter trening kan trener registrere faktisk oppmøte på gruppenivå, faktisk gjennomførte øvelser, endringer og evaluering. Plan og faktisk gjennomføring lagres hver for seg.
- Evalueringer skal være tilgjengelige som kontekst for senere planlegging, men være private for lagets autoriserte trenere og administratorer.
- Status minst: `utkast`, `planlagt`, `gjennomført` og `avlyst`. `Gjennomført` krever registrert gjennomføring; delingsstatus er en separat egenskap.
- Historikkvisning skal kunne filtreres på dato, tema, status og øvelse, og gjøre det enkelt å finne tidligere økter med samme tema.

### Automatisk utkast

- Et lag kan slå automatisk generering av utkast av eller på.
- Laget angir treningstidene sine med fra-/til-tid og hvor mange dager før en trening et utkast skal opprettes automatisk dersom ingen økt allerede er opprettet manuelt. Utkastets varighet beregnes fra den aktuelle treningstiden, ikke en lagfelles standard.
- Eksempel: Laget trener onsdag kl. 18 og setter automatisk oppretting til tre dager før. Hvis ingen økt finnes for onsdagen når fristen nås, oppretter systemet ett AI-utkast basert på kalender, periodeplan, historikk og evalueringer.
- Laget kan også angi hvor mange sammenhengende treninger en plan eller progresjonsblokk skal gjelde. Dette er separat fra lengden på hver treningsøkt.
- Automatisk generering oppretter bare et utkast. Den skal aldri godkjenne, publisere eller sende ut en offentlig lenke uten menneskelig handling.
- Jobben skal kjøre for lagets lokale treningstid og være idempotent: ikke opprett et duplikatutkast dersom trener allerede har opprettet en økt for samme trening, eller dersom jobben kjører flere ganger. Feil og manglende grunnlagsdata vises for treneren og kan forsøkes på nytt.
- Trenerne kan pause automatiseringen, endre innstillinger og be om et utkast manuelt.

### Offentlig deling og medier

- Hver godkjente økt kan få en separat, tilfeldig og tilbakekallbar offentlig lenke uten automatisk utløpstid. Lenken gir kun lesetilgang til den delte økten og virker til den tilbakekalles manuelt.
- Kalenderdeling er separat, har heller ingen automatisk utløpstid og er avgrenset til eksplisitt valgte datoer og felter. Evalueringer, interne kommentarer, invitasjoner og medlemsdata skal aldri inngå i offentlig visning.
- Delte sider skal kunne åpnes uten konto. Klubb eller lag kan tilbakekalle deling når som helst.
- Offentliggjøring skal vise øktinnhold, ikke opplysninger om enkeltbarn. Spillerantall kan vises bare aggregert og etter trenerens valg.
- Medier støtter bilder, video og animasjoner. Eksterne innbygginger begrenses til godkjente leverandører; vis alltid en vanlig kildelenke som reserve.
- Ikke kopier eller last opp eksterne videoer uten rettigheter. Bruk lenke eller tillatt innebygging og ta hensyn til personvern og samtykke ved opptak.
- Eksisterende taktikktavler bruker JSON med objekter og animerte steg, og har en visuell redigerer. Integrer redigereren i Next.js-appen, gjenbruk dagens JSON-format og bevar eksisterende funksjoner for oppretting, åpning, redigering og eksport. Behold tekstlig øvelsesbeskrivelse, avspilling på brukerens initiativ og støtte for redusert bevegelse.
- MVP kan lagre små animasjonsdata i Neon og bruke eksterne videolenker; egen videolagring er utenfor første leveranse.

## Viktige brukerreiser

### Navigasjon og mobilgrensesnitt

- Standardpaletten er Tiim-inspirert: primær `#0056f5`, aksent `#ecf0ea`, bakgrunn `#fafafa` og tekst `#2e2e2e`. Bruk lokalt levert Montserrat og egne komponenter, uten å kopiere Tiims identitet, proprietære fonter eller kildekode. Klubbprofilen overstyrer primær-/aksentfarger; eksisterende lagrede farger må ikke overskrives ved designoppgradering.
- Øktvisningen samler tittel, dato/tidsrom, status og siste planoppdatering i en toppdel. Deretter følger faktaboks, øvingsmål og innholdsnavigasjon, så delene Oppvarming, Hoveddel og Avslutning med tidsummer. Temaarbeid og spill presenteres som Hoveddel, uten å endre den lagrede øvelsesrekkefølgen eller planmodellen.
- Øvelseskort viser navn, varighet og gjennomføring, samt sammenleggbare seksjoner for målsetting, læringsmomenter, organisering, variasjoner og egne ressurs-/kildefelt. Behold redigering, validering, ressurskontroll og versjonshistorikk, med unike ankerlenker per historisk plan. Bare implementerte handlinger vises; deling/publisering skal ikke ha virkningsløse knapper.

- Responsivt grensesnitt med fast sidemeny til venstre på desktop og én samlet slide-in-meny fra venstre på mobil/smale skjermer, åpnet med hamburgerknapp. Hovedvalg og autoriserte klubb-/lagvalg samles i denne menyen uten ekstra mobilfaner eller duplisert navigasjon i sideinnholdet. Menyen har tastaturbetjening, fokusfelle og fokusretur, bakgrunnsoverlegg, rullelås og markering av aktiv side; den kan lukkes med Escape, lukkeknapp eller bakgrunnstrykk. Redusert bevegelse respekteres. Konto vises som avatar øverst til høyre med egen meny for innloggingsinformasjon og utlogging.
- Klubbens lag, brukere/administratorer og innstillinger skal ha egne sider. Lagmenyen har fem valg: **Økter**, **Årsplan**, **Brukere**, **Innstillinger** og **Egne øvelser**, likt på desktop og mobil.
- **Økter** er lagets startside med kommende trening og siste lagrede økter. Hvis neste trening mangler kladd, vises en plassholder med genereringsdato ut fra lagets antall dager før trening og en knapp for manuell oppretting med arvet treningstid. Før automatisering er implementert og aktivert, må datoen merkes som ønsket tidspunkt, ikke en planlagt jobb. Ingen tidligere trening skal fremstilles som gjennomført uten faktisk gjennomføringsinformasjon. Årsplanen nås fra denne siden.
- **Årsplan** viser et klikkbart årshjul og en vertikalt rullbar månedsoversikt med temaer, øvingsmål og progresjon. Valgt måneds treninger og øvrige hendelser vises samlet, med fortsatt tilgang til redigering av årsretning og temaperioder. Månedsvalg beholdes i URL-en.
- **Egne øvelser** gir tilgang til den integrerte animasjonseditoren. Første integrasjon bruker eksisterende JSON-import/-eksport og gjør det tydelig at filer må lastes ned; delt, versjonert lagring per lag og kobling til øktkort kommer som eget steg.
- Oversiktssider skal prioritere innhold og snarveier, ikke samle alle administrasjonsskjemaer. Oppretting av klubb, lag og enkeltøkt har dedikerte sider.
- Årsplanens måned velges i årshjulet, månedsmenyen eller den rullbare årsoversikten. På mobil viser dagrutene antall treninger og hendelser, med fullstendige detaljer/handlinger under.
- Menyvalg og sider skal følge eksisterende rollegrenser. Direkte URL-tilgang skal kontrolleres på serveren. Lagring og feil skal returnere til riktig underside.

1. **Opprette klubb:** bruker logger inn, oppretter klubb, legger til administratorer, oppretter lag og registrerer felles sportsplan, veiledning og utstyr.
2. **Starte lag:** klubbadministrator oppretter lag og inviterer hovedtrener som første medlem. Hovedtrener aksepterer med magic link og kan invitere lagets øvrige trenere.
3. **Administrere lagmedlemmer:** hovedtrener inviterer eller fjerner trenere på eget lag. Klubbadministrator kan også legge til eller fjerne medlemmer i alle lag.
4. **Planlegge økt:** trener velger dato og tema i kalenderen, oppgir antall spillere/trenere og rammer, genererer AI-utkast, kontrollerer kilder og utstyrsregnskap, redigerer og godkjenner.
5. **Gjennomføre og lære:** trener registrerer faktisk gjennomføring og evaluering etter økten. Agenten kan bruke dette ved neste forslag.
6. **Dele:** trener velger økt eller kalenderinnhold, forhåndsviser offentlig side og oppretter en lenke uten automatisk utløp. Lenken kan kopieres og tilbakekalles.
7. **Automatisere:** trener konfigurerer treningstidenes fra-/til-tider og antall dager før trening. Hvis ingen økt er opprettet manuelt innen fristen, systemet lager ett utkast med treningens varighet og venter på godkjenning.

## Foreslått datamodell

Tabellene implementeres med Drizzle og Neon Postgres. Dette er logiske objekter; eksakt normalisering og kolonnenavn fastsettes i databasemigrasjonene.

| Objekt | Innhold og relasjoner |
| --- | --- |
| `users` / auth-identiteter | Neon Auth-identitet og visningsopplysninger |
| `clubs` | Klubb og innstillinger |
| `club_memberships` | Bruker, klubb, rolle og medlemsstatus |
| `groups` | Undergruppe tilhørende klubb, eksempelvis G2017 |
| `group_memberships` | Bruker, lag, rolle (`head_coach` eller `coach`) og status |
| `club_documents` | Sportsplan, veiledning og annet klubbfelles innhold med versjoner |
| `equipment` | Klubbens utstyr og eventuelle gruppejusteringer |
| `group_plans` | Års-/periodeplan og tema/progresjon |
| `annual_events` | Klubb/lag, heldagshendelse, type, tittel, datointervall, beskrivelse, revisjon og oppretter/siste endrer |
| `training_series` | Faste treningstider med fra-/til-tid, dager før automatisk oppretting, blokkvarighet og automatiseringsinnstillinger |
| `sessions` | Dato, fra-/til-tid, beregnet varighet, tema, status, spiller-/trenerantall og rammer |
| `session_versions` | Uforanderlige planversjoner, AI-/manuell opprinnelse og godkjenning |
| `change_history` | Uforanderlige endringsposter med klubb/lag, berørt økt/plan, aktør, tidspunkt, handling, opprinnelse og endrede verdier eller versjonsreferanser |
| `session_activities` | Tidsplan, lag, øvelser, roller og utstyrsbehov per versjon |
| `sources` | Tiim-/eksterne lenker, kildetype, aldersmerking og kontrolltidspunkt |
| `evaluations` | Faktisk gjennomføring og evaluering knyttet til økt og lag |
| `media` | Tillatte medielenker eller taktikktavle-JSON knyttet til øktversjon |
| `public_shares` | Hash av hemmelig delingstoken, innholdsomfang og tilbakekalling; ingen automatisk utløpstid |
| `generation_jobs` | Automatiske/manuelle genereringsjobber, status og feilinformasjon |

Hver tenant-eid rad må ha klubbtilknytning. Laginnhold må i tillegg være bundet til riktig lag. Bruk sammensatte fremmednøkler eller tilsvarende databasebegrensninger for å hindre at en referanse peker på et lag fra en annen klubb. Interne `groups`-navn og eksisterende `/grupper/…`-lenker kan beholdes for bakoverkompatibilitet; grensesnittet bruker «Lag».

Den lokale planleggingsleveransen bruker `annual_plans`, `plan_periods`, `annual_events`, `training_events` og `session_versions`. Øvelseskort, ressursforutsetninger og kildefelt ligger foreløpig i validert, versjonert JSON per planversjon. Årsplankontekst lagres som snapshot sammen med versjonen, inkludert NFF-kildelenke, hendelser som overlapper treningsdatoen og markering av at AI-forslag ennå ikke er aktive. Endring/fjerning av hendelser omskriver ikke historiske versjoner. Hendelser har revisjonsvern og oppretter/siste endrer; full uforanderlig endringshistorikk er fortsatt et senere steg. Senere AI-integrasjon må bruke samme validering og versjonering, og hente faktisk historikk, evalueringer og klubbfelles innhold når disse er implementert.

## Teknisk løsningsretning

- **Web:** Next.js med TypeScript og HeroUI-komponenter med Tailwind CSS. Autorisasjon og datatilgang håndteres server-side.
- **Database:** Neon Postgres i deployede miljøer og PGlite som standard lokalt, med samme Drizzle-skjema og SQL-migrasjoner. PGlite kjører innebygd i Node.js og lagrer utviklingsdata på disk uten Docker eller egen databaseserver.
- **Lokal oppstart:** Kjør `npm run db:migrate` manuelt ved første oppsett og etter nye migreringer, mens appen er stoppet. Kommandoen åpner PGlite, kjører ventende Drizzle-migreringer og lukker forbindelsen. `npm run dev` starter Next.js direkte. Fillås hindrer samtidige prosesser i å åpne samme PGlite-mappe. Appen deler én instans mellom forespørsler.
- **Migreringer i deploy:** produksjonsmigrering kjøres som et eget kontrollert deploy-steg mot Neon, ikke som sideeffekt av hver Vercel-funksjonsstart. Samme versjonerte Drizzle-migreringer brukes lokalt og i deploy.
- **Auth:** Neon Auth magic link og langvarig, tilbakekallbar innlogget økt i deployede miljøer. Auth-laget abstraheres slik at lokal utvikling bruker lokal auth-adapter med samme bruker-/rollegrensesnitt uten å koble til Neon Auth.
- **AI:** Vercel AI Gateway; modell- og verktøytilgang styres fra serveren. API-nøkler og hemmeligheter lagres i miljø-/secret management, aldri i klientkode eller databaseinnhold.
- **Hosting og automatisering:** Next.js-appen hostes på Vercel. Bruk planlagte Vercel-jobber eller en tilsvarende driftssikker scheduler til å opprette utkast før lagets treningstid; jobbstatus lagres i databasen, og jobben må tåle gjentatte kjøringer.
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

**MVP omfatter:** klubber og lag, invitasjon av hovedtrener som første lagmedlem, gruppeadministrasjon for hovedtrener, klubbadministrasjon av lagmedlemskap, magic link, lokal utviklingsmodus med PGlite og lokal auth uten Docker-/Neon-avhengighet, HeroUI-grensesnitt, klubbfelles innhold, gruppekalender og periodeplan, manuell øktplanlegging, AI-utkast og promptbasert revisjon, historikk/evaluering, utstyrs- og grupperegnskap, valgfri automatisk utkastjobb, offentlige skrivebeskyttede lenker og visning av støttede medier/taktikktavler.

**Ikke del av MVP:** spillerkontoer eller individuelle profiler, kampadministrasjon, betaling, automatisk publisering, egen videohosting, ubegrensede eksterne iframe-kilder og en uautorisert direkteintegrasjon mot Tiim. Taktikkredigereren integreres i Next.js-appen ved å gjenbruke eksisterende format og funksjoner, ikke ved å bygge en separat ny redigerer fra grunnen.

## Akseptansekriterier

1. En bruker kan tilhøre to klubber og bare se data for klubber/lag der brukeren har aktivt medlemskap.
2. Klubbadministrator kan legge til en annen administrator, opprette et lag og invitere hovedtrener som første lagmedlem.
3. Hovedtrener kan invitere og fjerne trenere på eget lag; klubbadministrator kan legge til og fjerne lagmedlemmer i alle klubbens lag.
4. En trener kan lage et AI-utkast der dato, tema, gruppeplan, relevant historikk/evaluering, spillerantall, trenerantall og utstyr er synlig brukt eller eksplisitt merket som manglende.
5. Utkastet viser kildelenker og kontrollert aldersmerking når det er tilgjengelig, og viser manglende kildegrunnlag uten å dikte opp opplysninger.
6. Planen viser tidsregnskap og samtidig behov for lag, trenere, mål og baller; avvik og ukjente tall får synlige varsler.
7. Manuell redigering og AI-revisjon oppretter ny versjon og bevarer tidligere godkjent plan og evaluering.
8. Lagets aktuelle faste treningstid med fra-/til-tid og antall dager før økten styrer automatisk utkast. Varigheten følger den aktuelle treningen. Et manuelt opprettet utkast hindrer duplikat, og automatiseringen publiserer aldri av seg selv.
9. Evaluering etter trening påvirker senere forslag uten at den blir synlig i offentlig deling.
10. En offentlig øktlenke viser bare valgte, godkjente treningsopplysninger uten innlogging. Lenken er skrivebeskyttet, har ingen automatisk utløpstid og slutter å virke etter tilbakekalling.
11. En offentlig kalenderlenke viser bare valgte datoer/felter; ingen evalueringer, invitasjoner eller medlemsdata.
12. Eksisterende taktikktavle-JSON kan vises med tekstalternativ, og animasjon starter først etter en aktiv handling fra leseren.
13. Sikkerhetstester verifiserer klubb- og gruppeskille for både lesing, endring og delte lenker, inkludert rollegrensene mellom klubbadministrator, hovedtrener og trener.
14. En utvikler kan starte lokal app med diskbasert PGlite uten Docker, Neon-tilkobling eller Neon Auth. Ventende Drizzle-migreringer kjøres manuelt med `npm run db:migrate` mens appen er stoppet. `npm run dev` starter vanlig Next.js uten eget oppstartsskript eller automatisk migrering, og lagrede data beholdes ved omstart.
15. Lokal magic-link- og invitasjonsflyt fungerer uten ekstern e-postutsending; lokal auth kan ikke aktiveres i deployede test- eller produksjonsmiljøer.
16. Deploy kjører migreringer kontrollert mot Neon uten at migreringer startes på nytt for hver Vercel-funksjonsinstans.
17. Klubbadministrator kan lagre logo og temafarger med forhåndsvisning. Profilen vises på klubbens, lagenes og klubbens offentlige sider uten å påvirke andre klubber, og løsningen har tilgjengelige kontraster og standardprofil som reserve.
18. Eksisterende sider bruker HeroUI for kort, knapper, lenker, tekst-/tallfelt og ukedagsvalg, med tilgjengelige etiketter, validering og uendret server-side tilgangskontroll.

## Avklaringer før implementering

- Hvor lang skal en innlogget økt vare, og skal den kunne huskes på en privat enhet?
- Skal kalenderen støtte én fast ukentlig treningsdag, flere dager eller frie datoer?
- Hvordan skal trenerne varsles når et automatisk utkast er opprettet?
- Hvilken e-postleverandør, hvilket domene og hvilken miljøinndeling (utvikling/test/produksjon) skal brukes med Vercel og Neon?
