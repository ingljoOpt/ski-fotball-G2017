# Implementasjonsplan for klubbøkter

Kravgrunnlag: [nettsted-spesifikasjon](nettsted-spesifikasjon.md).

## 1. Kjørbart lokalt fundament

- [x] Next.js med TypeScript, norsk grensesnitt og responsiv navigasjon.
- [x] HeroUI v3 og Tailwind CSS v4 på eksisterende sider, med tilgjengelige skjemaetiketter og innsendingstilstand.
- [x] Hamburgermeny, aktive menyvalg og mobiltilpasning. Egne sider for klubb-/lagbrukere og innstillinger, samt oppretting av klubb, lag og enkeltøkt. Oversikter uten administrasjonsskjemaer.
- [x] Fast venstre sidemeny på desktop, hamburgermeny bare på smale skjermer og kontoavatar øverst til høyre med egen utloggingsmeny. Nettleserkontroll ved 320, 375 og 1280 piksler, inkludert Escape og fokusretur.
- [x] Lokal PGlite med diskbasert lagring uten Docker eller egen databaseserver.
- [x] Postgres-skjema og versjonerte Drizzle-migreringer. Neon-tilkobling verifiseres i produksjonssteget.
- [x] Vanlig `next dev` uten eget oppstartsskript. Migrering kjøres manuelt med `npm run db:migrate` mens appen er stoppet; PGlite har fillås mot samtidige prosesser.
- [x] Lokal magic-link-innlogging og innlogget sesjon uten ekstern e-post.
- [x] Sperre lokal auth i deployede miljøer.

## 2. Klubber, lag og tilgang

- [x] Opprette klubb med innlogget bruker som klubbadministrator.
- [x] Opprette lag og invitere hovedtrener som første medlem.
- [x] Hovedtrener kan invitere og fjerne trenere på eget lag.
- [x] Klubbadministrator kan legge til og fjerne lagmedlemmer.
- [x] Lagets faste treningstider med fra-/til-tid og antall dager før automatisk oppretting lagres. Varigheten følger hver trening; ingen lagfelles standardvarighet. Selve automatikkjobben kommer i steg 4.
- [x] Flere klubbadministratorer og overføring av hovedtrenerrolle, med e-postbundet invitasjon/tilbakekalling, vern av siste administrator og atomisk rollebytte til eksisterende lagmedlem.
- [x] Klubbprofil: klubbadministrator kan laste opp logo og velge primær-/aksentfarger, med forhåndsvisning, validering og tilbakestilling til standard.
- [x] Bruke klubbprofil på klubbkort, klubb- og lagsider; kontrollere kontrast, logoens tekstalternativ og isolasjon mellom klubber.
- [ ] Bruke den delte klubbprofilkomponenten på offentlige økt-/kalendersider når disse implementeres i steg 5.
- [x] Autorisasjonstester for første leveranses klubb-, lag- og rollegrenser.
- [x] Stabile klubb-/lagslugs, pene adresser for planer og økter, slugbasert navigasjon og skjemaretur, tilgangskontrollerte videresendinger fra tidligere ID-adresser og lokal migrering uten endring av medlemskap/historikk.

## 3. Årsplan og manuell øktplanlegging

- [x] Månedsvisning i årsplanen med gjentakende treninger, unntak og enkeltøkter. Ingen separat kalenderside; gamle lenker videresendes med valgt år/måned.
- [x] Cup, ferie/fridag og øvrige heldagshendelser med datointervall, redigering/fjerning, tenant-grenser og revisjonsvern. Hendelser avlyser ikke treninger automatisk og inngår i nye kontekstsnapshots uten å endre historiske øktversjoner.
- [x] Lagmeny med Økter, Årsplan, Brukere, Innstillinger, Egne øvelser og Sportsplan. Økter som startside med neste trening, genereringsplassholder, manuell oppretting og fem siste lagrede økter.
- [x] Klikkbart årshjul og vertikalt rullbar årsoversikt med månedens temaer, øvingsmål og progresjon.
- [x] Fra-/til-tid på hver økt, automatisk beregnet varighet og serverstyrt arv av tidsrom fra valgt trening. Migrere eksisterende tider/økter og historiske snapshots uten å endre tidligere varighet.
- [x] Års-/periodeplan med tema, øvingsmål og progresjon. Årgang er en laginnstilling, med rollebeskyttet redigering og alder/NFF-kilde per planår.
- [x] Bruk «Lag» i grensesnittet. Behold eksisterende lenker og interne modellnavn. Migrer entydige årganger fra årsplaner, vis konflikter for avklaring og bevar tidligere verdier og øktversjoner.
- [x] Aldersbestemt NFF-kildelenke og lagret årsplankontekst, uten automatisk temagenerering før steg 4.
- [x] Klubbfelles sportsplan og veiledning: administratorstyrt opplasting av flere Markdown-, PDF- og Word-dokumenter, Markdown-redigering, lesetilgang for trenere og arkivering av tidligere versjoner. Lagrede øktplaner endres ikke.
- [ ] Visning og gjenoppretting av arkiverte klubbdokumenter.
- [ ] Klubbfelles utstyrsliste med versjonering og lokale lagtilpasninger.
- [x] Manuelle øktutkast med Tiim-inspirert oppbygning, ordnede øvelseskort og uforanderlige planversjoner.
- [x] Tiim-inspirert øktdesign med toppdel, faktaboks, innholdsnavigasjon, tidsummerte deler og øvelseskort med sammenleggbare fag-/ressursfelt. Blå standardpalett og lokalt levert Montserrat; lagrede klubbprofiler og øvelsesrekkefølge bevares. Utskrift og snarvei til redigering.
- [x] Full endringshistorikk for økter, årsplaner og periodeplaner: vis hvem, når og hva som ble endret, også ved statusendringer og sletting av perioder. Lagre historikk atomisk med endringen, skill bruker-/AI-/systemhandlinger og hold aktøridentitet utenfor offentlig deling. Eksisterende øktversjoner er migrert; uloggede statusendringer og årsplaner/perioder fra før funksjonen mangler snapshots og kan ikke rekonstrueres.
- [x] Oppmøteforutsetninger og kontroller av tid, trenerbehov og samtidig utstyr, med sperre mot ufullstendig godkjenning.
- [x] Felles strukturert plan-/kildekontrakt og kontekstsnapshots som grunnlag for AI i steg 4.
- [x] Privat evaluering etter planlagt sluttid: valgfri vurdering 0–5 og kommentar per øvelse samt generell kommentar, med minst ett utfylt felt og binding til planversjon.
- [ ] Faktisk oppmøte og registrering av gjennomførte øvelser uten spillerprofiler.

## 4. AI og automatisering

- [x] Første øktagent med Vercel AI SDK ToolLoopAgent, Vercel AI Gateway og `@ai-sdk/react` (AI SDK UI): streaming-chat i sidestolpe ved redigering, forhåndsvisning og eksplisitt bruk av et validert forslag.
- [x] Tenant-avgrenset kontekst fra gjeldende usparte økt, årgang, årsplan, hendelser og fem tidligere planer; gjenbruk av eksisterende kildeopplysninger uten ny kildekontroll.
- [x] Bruke aktive klubbdokumenter som tenant-avgrenset kilde i øktagenten via et eget dokumentverktøy, med tydelig informasjon om at uttrukket tekst sendes til modellleverandøren. Dokumenter lastes opp av klubben; automatisk innhenting fra klubbens nettsted er ikke implementert.
- [x] Inkludere trenerregistrerte evalueringer fra tidligere økter i samme lag i agentkonteksten, uten treneridentitet.
- [ ] Utvide agentkontekst med klubbfelles utstyr når dette finnes.
- [x] Foreslå årsplantemaer og øvingsmål fra lagret aldersriktig NFF-fagplan, med kildeopplysninger og eksplisitt trenerbekreftelse. Ved oppdatering kontrolleres kildebelegg og aldersmerking; 8–9 år følger med som startdata.
- [ ] Verifisere faktisk NFF-innhenting via Gateway og aktuelle kilder for andre aldersklasser enn de medfølgende startdataene. Oppdatering og kildekontroll er hittil testet med simulert modell og fiktive kilder.
- [x] Bruke planleggingskontrakten og versjonsflyten for AI-assisterte revisjoner; ta hensyn til manuelt oppdaterte spiller-/trenerantall, bevare bekreftede rammer, eksakt tidslengde og gamle øktversjoner.
- [x] Tiim-subagent for offentlig øvelseskatalog: filtrerer på alder, tema og øvingsmål, kontrollerer valgte øvelsessider og viser kildeadvarsler. Verifisert med fiktive planleggingsdata, ekte Tiim-kilder og Gateway-modell i både subagent og øktagent. Bilder og video kontrolleres ikke.
- [x] Komplett AI-forslag med kontrollpunkter, eksplisitt erstatning i skjemaet, vern mot utdaterte forslag og AI-merket versjon ved trenerens lagring. Manuelt opprettede enkeltøkter starter med et automatisk AI-førsteutkast som kan redigeres eller justeres videre i chatten. Forslaget lagres ikke før treneren velger lagring/godkjenning.
- [ ] Produksjonsklar felles ratebegrensning og kostnadsbudsjett på tvers av Vercel-instanser. Første lokale agent har grense per prosess.
- [ ] Verifisere planlagte AI-utkast på Vercel etter at produksjonsdatabase og autentisering er klare. Cron, dobbeltkjøringsvern, norsk sommertid og opt-in er testet lokalt med isolert database; ingen produksjonsdeploy er utført.
- [ ] Støtte for gjenbruk av økt i flere uker og individuell gjennomføring per dato.

## 5. Deling og medier

- [ ] Tilbakekallbare økt- og kalenderlenker uten utløp, med eksplisitt offentlig feltutvalg.
- [x] Integrere eksisterende taktikkredigerer og JSON-format i Next.js under Egne øvelser, med autorisert lokal levering og filimport/-eksport.
- [ ] Felles databaselagring av egne øvelser/animasjoner per lag og kobling til øktkort, med versjonering og tilgangskontroll.
- [ ] Sikker innebygging av Tiim-/andre videoer med kildelenke som reserve.
- [ ] Tilgjengelighet, mobilbruk og tekstalternativer.

## 6. Produksjon og kvalitet

- [ ] Neon Auth-adapter og produksjonsutsending av invitasjoner/magic links.
- [ ] Neon-database og kontrollert migreringssteg før deploy.
- [ ] Vercel-oppsett, miljøisolasjon, scheduler og hemmeligheter.
- [ ] Revisjonslogg, begrensning av innloggings-/AI-kall og overvåking av feil/kostnader.
- [ ] Tester av hele brukerreisen, deling, tilbakekalling og tenant-isolasjon.
- [ ] Dokumentert oppstart, backup/gjenoppretting og deploy.

## Leveransestatus

Sportsplan og veiledning har egen klubb- og lagmeny. Administrator kan laste opp dokumenter eller opprette og redigere Markdown; trenere kan lese og laste ned. Endringer arkiverer tidligere versjon, men arkivvisning og gjenoppretting mangler. Øktagenten får bare aktive dokumenter fra riktig klubb. Målrettet kjøring av dokument-, tilgangs-, AI- og NFF-testene ga 31 beståtte tester, inkludert databasekontroller. NFF-innhenting og AI-forslag i denne testkjøringen bruker simulert modell, ikke et ekte Gateway-kall.

Første AI-øktassistent er implementert med AI SDK/Gateway og AI SDK UI-chat i øktredigeringen. Kontroller av kontekst, tenant-grenser, kildedata, eksakt varighet, ressurser og eksplisitt AI-assistert versjonslagring er testet. Verifiseringen omfatter 43 enhetstester og 33 databasekontroller, typekontroll, lint og produksjonsbygg. Streaming/proposal-flyten er kontrollert med simulert modell; ekte Gateway-kall krever servernøkkel og er ikke verifisert uten denne.

Autentiserte HTTP-kontroller dekker manglende Gateway-nøkkel (503), innlogging (401), fremmed origin (403), ugyldig melding/størrelsesgrense (400) og feil økt/utdatert revisjon (409). Nettleserkontrollen med fiktive data dekker desktop-sidestolpe, mobil ved 320/375 piksler uten overløp, forslag uten automatisk lagring, avvisning etter manuell endring, eksplisitt bruk og ny AI-merket versjon, strømmefeil og bevaring av skjema ved avvist godkjenning. Ingen ekte klubbdata er sendt til en modell eller brukt som testdata.

Årsplanen samler nå månedsvisning av treninger, cup, ferie/fridager og øvrige heldagshendelser. Den separate kalendersiden er fjernet; tidligere lenker videresendes med år og måned bevart. Hendelser krever ikke en lagret årsplan, kan krysse årsskiftet og avlyser ikke treninger automatisk. Månedsvalg følger URL og skjemaer. Nye øktversjoner tar med relevante hendelser, mens gamle snapshots bevares. Oppretter/siste endrer og revisjonsvern er på plass; full audit er fortsatt uavkrysset.

Verifisert med 37 enhetstester og 32 databasekontroller. Autentisert nettleserkontroll med fiktive data dekker oppretting, redigering og fjerning uten manuell gjenlasting, avvisning av utdaterte revisjoner, juleferie fordelt mellom desember og januar, bevart månedsvalg ved årsskifte og planlegging med arvet fra-/til-tid. Mobilkontroll ved 320/375 piksler og desktop ved 1280 piksler har ingen horisontal overløp, og mobilmenyen markerer Årsplan. Lokal migrering er kjørt manuelt; ingen testhendelser er lagt i klubbens database.

Grensesnittet bruker nå «Lag», og årgang administreres på laget, ikke i årsplanen. Migrering av entydige årganger, avklaring av konflikter, rollegrenser og uendrede historiske øktversjoner er verifisert med 33 enhetstester og 29 databasekontroller. Typekontroll, lint og produksjonsbygg er bestått. Autentisert HTTP-kontroll dekker lagmeny, oppretting, innstillinger og aldersriktig NFF-kilde på tvers av planår. Lokal database er migrert.

Navigasjonsoppryddingen skiller oversikter fra administrasjon: klubbens lag, brukere og profilinnstillinger har egne ruter. Lagmenyen inneholder Økter, Årsplan, Brukere, Innstillinger, Egne øvelser og Sportsplan, samlet i slide-in-meny på mobil og venstre sidemeny på desktop. Økter viser kommende trening og siste lagrede økter; genereringsdato er tydelig merket som en inaktiv AI-plassholder. Årsplanen har et interaktivt årshjul og rullbar månedsoversikt. Animasjonseditoren gjenbruker eksisterende kode og JSON-format lokalt i appen, med filbasert lagring hos treneren inntil felles øvelsesbank er implementert. Oppretting av klubb, lag og enkeltøkt har dedikerte sider. Kalenderen nås fra Økter. Konto og utlogging er samlet i en egen meny.

Verifisert med 30 enhets-/animasjonstester, 26 databasekontroller, typekontroll, lint og produksjonsbygg. Nettleserkontrollen dekker seks hoved-/administrasjonssider ved 375 pikslers bredde, kalender, profil og enkeltøktskjema ved 320 piksler og klubboversikt ved 1280 piksler uten horisontal sideoverløp. Hamburgermenyen er kontrollert med tastatur, Escape, aktivt menyvalg og lukking ved navigasjon. Avviste skjemaer returnerer til riktig underside uten å opprette data.

Den lokale leveransen dekker punkt 1 og avkryssede deler av punkt 2 og 3. Lokal oppstart, engangsinnlogging, oppretting av klubb/lag, invitasjonsaksept og lagring av treningstider er testet i nettleser, inkludert mobilbredde og gjenlasting.

Byttet til PGlite og HeroUI er verifisert med 17 enhets-/animasjonstester og 8 databasekontroller, typekontroll, lint og produksjonsbygg. Nettlesertesten dekker HeroUI-skjemaer, ukedagsvalg med mus og tastatur, invitasjonsaksept, mobilvisning uten horisontal overløp og utlogging. Serveromstart bevarer både øktrammer, treningstider og innlogget sesjon i PGlite.

Utvidet rolleadministrasjon er verifisert med 17 enhets-/animasjonstester og 13 databasekontroller, typekontroll, lint og produksjonsbygg. Nye tester dekker administratorinvitasjonens utløp, engangsbruk, e-postbinding, erstatning og tilbakekalling, tilgang til klubbens øvrige lag, tenant-grenser, bevaring av lagmedlemskap og samtidige forespørsler om fratreden. Hovedtreneroverføring tester rollegrensene, medlemskravet, nedgradering av tidligere hovedtrener og tilbakekalling av gamle hovedtrenerinvitasjoner.

Nettleserkontrollen med isolerte, fiktive data dekker invitasjon og tilbakekalling, avvisning ved feil innlogget e-post, innlogging tilbake til administratorinvitasjonen, aksept, deaktivert knapp for siste administrator, rolleoverføring via HeroUI-valg og fratreden med bevart gruppetilgang. Klubb- og lagsidene er kontrollert ved 375 pikslers bredde uten horisontal overløp. Eksisterende lokal database er ikke brukt til denne kontrollen.

Klubbprofilen har administratorstyrte primær-/aksentfarger og logoopplasting med lokal forhåndsvisning. Serveren håndhever kontrast og bildegrenser, skalerer/omkoder til WebP uten opprinnelige metadata og lagrer logoen i databasen. Verifisert med 23 enhets-/animasjonstester, 14 databasekontroller, typekontroll, lint og produksjonsbygg. Testene dekker filtypeforfalskning, korrupt bilde, animasjon, nøyaktige størrelses-/pikselgrenser, tomme filvalg, manglende administratorrettigheter, tenant-isolasjon, bevaring/fjerning av logo, tilbakestilling og persistens etter omstart.

Nettleserkontrollen av klubbprofilen bruker egen PGlite-database med fiktive klubber. Den dekker opplasting, forhåndsvisning uten lagring, valideringsfeil, fargeendring uten nytt logovalg, automatisk lys/mørk tekst, fjerning av bare logo og tilbakestilling. Farger/logo vises på klubbkort, klubb- og lagsider uten å påvirke en annen klubb. Hovedtrener kan se profilen, men får ikke redigeringsskjema. Mobilkontrollen ved 375 piksler har ikke horisontal overløp. Offentlig profilvisning gjenstår sammen med delingssidene.

Typekontroll, lint, eksisterende animasjonstester, nye konfigurasjonstester, PGlite-integrasjonstester og produksjonsbygg er kontrollpunkter for leveransen. Databasetestene bruker isolerte midlertidige mapper, uten Docker eller miljøfil, og verifiserer fillås, persistens og at migreringer ikke kjøres på nytt ved omstart. HeroUI erstatter de håndlagde UI-komponentene uten å endre autorisasjonsreglene. `publiserte/assets/package.json` bevarer CommonJS-kompatibiliteten til de eksisterende UMD-baserte animasjonsmodulene mens webappen bruker ES-moduler.

Kalender og manuell øktplanlegging er verifisert med 29 enhets-/animasjonstester, 24 databasekontroller, typekontroll, lint og produksjonsbygg. Databasetestene dekker virtuelle uketider, samtidige/idempotente opprettinger, temaperioder, godkjenning, utdaterte redigeringer, tenant-grenser og sammensatte fremmednøkler. De tester også flytting over årsskiftet, avlysning/gjenåpning, bevaring av opprinnelig årsplankontekst og persistens etter ny åpning.

Fra-/til-tider er kontrollert med 30 enhets-/animasjonstester og 26 databasekontroller, typekontroll, lint og produksjonsbygg. Testene dekker ulike lengder på ukentlige treninger, serverstyrt arv ved kalenderoppretting, automatisk omberegning ved endring, tidsgrenser og midnatt. Oppgradering fra befolket eldre skjema bevarer varigheter og historiske verdier og kan kjøres på nytt uten endringer.

Nettleserkontrollen med en vanlig trener og isolerte, fiktive data dekker årsplan og temaperiode, aldersriktig NFF-lenke, kalender med arvede temaer, utkast og godkjenning, øvelsesrekkefølge/fjerning, versjonshistorikk, flytting og avlysning/gjenåpning. Avvist godkjenning bevarer tekstfelt, tekstområder, tall og øktdel. Årsplan, kalender og åpen øktbygger er kontrollert ved 375 pikslers bredde uten horisontal overløp. Ingen faktiske lagøkter er opprettet i Markdown-historikken.

Klubbfelles utstyr, arkivvisning for dokumenter og registrering av faktisk oppmøte og gjennomførte øvelser gjenstår i steg 3. Private evalueringer er implementert separat fra øktplanen. Den første AI-assistenten og lokale NFF-temaforslag er implementert, men live NFF-innhenting via Gateway, planlagte automatiske utkast, Neon Auth og offentlig deling er fortsatt uverifisert eller uferdig. Dagens tallkontroll gjør ikke om organiseringen på egen hånd. Avkrysning gjøres først når funksjonen er implementert og verifisert. Se også kjente utviklingsavhengighetsvarsler i [README](../README.md#verifisering-og-migreringer).
