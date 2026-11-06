# Implementasjonsplan for klubbøkter

Kravgrunnlag: [nettsted-spesifikasjon](nettsted-spesifikasjon.md).

## 1. Kjørbart lokalt fundament

- [x] Next.js med TypeScript, norsk grensesnitt og responsiv navigasjon.
- [x] HeroUI v3 og Tailwind CSS v4 på eksisterende sider, med tilgjengelige skjemaetiketter og innsendingstilstand.
- [x] Hamburgermeny, aktive menyvalg og mobiltilpasning. Egne sider for klubb-/gruppebrukere og innstillinger, samt oppretting av klubb, gruppe og enkeltøkt. Oversikter uten administrasjonsskjemaer.
- [x] Fast venstre sidemeny på desktop, hamburgermeny bare på smale skjermer og kontoavatar øverst til høyre med egen utloggingsmeny. Nettleserkontroll ved 320, 375 og 1280 piksler, inkludert Escape og fokusretur.
- [x] Lokal PGlite med diskbasert lagring uten Docker eller egen databaseserver.
- [x] Postgres-skjema og versjonerte Drizzle-migreringer. Neon-tilkobling verifiseres i produksjonssteget.
- [x] Oppstart som åpner PGlite og migrerer før Next.js starter, med fillås mot samtidige prosesser.
- [x] Lokal magic-link-innlogging og innlogget sesjon uten ekstern e-post.
- [x] Sperre lokal auth i deployede miljøer.

## 2. Klubber, grupper og tilgang

- [x] Opprette klubb med innlogget bruker som klubbadministrator.
- [x] Opprette gruppe og invitere hovedtrener som første medlem.
- [x] Hovedtrener kan invitere og fjerne trenere i egen gruppe.
- [x] Klubbadministrator kan legge til og fjerne gruppemedlemmer.
- [x] Gruppens faste treningstider med fra-/til-tid og antall dager før automatisk oppretting lagres. Varigheten følger hver trening; ingen gruppefelles standardvarighet. Selve automatikkjobben kommer i steg 4.
- [x] Flere klubbadministratorer og overføring av hovedtrenerrolle, med e-postbundet invitasjon/tilbakekalling, vern av siste administrator og atomisk rollebytte til eksisterende gruppemedlem.
- [x] Klubbprofil: klubbadministrator kan laste opp logo og velge primær-/aksentfarger, med forhåndsvisning, validering og tilbakestilling til standard.
- [x] Bruke klubbprofil på klubbkort, klubb- og gruppesider; kontrollere kontrast, logoens tekstalternativ og isolasjon mellom klubber.
- [ ] Bruke den delte klubbprofilkomponenten på offentlige økt-/kalendersider når disse implementeres i steg 5.
- [x] Autorisasjonstester for første leveranses klubb-, gruppe- og rollegrenser.

## 3. Kalender og manuell øktplanlegging

- [x] Kalender med gjentakende treninger, unntak og enkeltøkter.
- [x] Gruppemeny med Økter, Årsplan, Brukere, Innstillinger og Egne øvelser. Økter som startside med neste trening, genereringsplassholder, manuell oppretting og fem siste lagrede økter.
- [x] Klikkbart årshjul og vertikalt rullbar årsoversikt med månedens temaer, øvingsmål og progresjon.
- [x] Fra-/til-tid på hver økt, automatisk beregnet varighet og serverstyrt arv av tidsrom fra valgt trening. Migrere eksisterende tider/økter og historiske snapshots uten å endre tidligere varighet.
- [x] Års-/periodeplan med tema, øvingsmål, progresjon og eksplisitt fødselsår.
- [x] Aldersbestemt NFF-kildelenke og lagret årsplankontekst, uten automatisk temagenerering før steg 4.
- [ ] Klubbfelles sportsplan, veiledning og utstyr med versjonering.
- [x] Manuelle øktutkast med Tiim-inspirert oppbygning, ordnede øvelseskort og uforanderlige planversjoner.
- [x] Tiim-inspirert øktdesign med toppdel, faktaboks, innholdsnavigasjon, tidsummerte deler og øvelseskort med sammenleggbare fag-/ressursfelt. Blå standardpalett og lokalt levert Montserrat; lagrede klubbprofiler og øvelsesrekkefølge bevares. Utskrift og snarvei til redigering.
- [ ] Full endringshistorikk for økter, årsplaner og periodeplaner: vis hvem, når og hva som ble endret, også ved statusendringer og sletting av perioder. Lagre historikk atomisk med endringen, skill bruker-/AI-/systemhandlinger og hold aktøridentitet utenfor offentlig deling.
- [x] Oppmøteforutsetninger og kontroller av tid, trenerbehov og samtidig utstyr, med sperre mot ufullstendig godkjenning.
- [x] Felles strukturert plan-/kildekontrakt og kontekstsnapshots som grunnlag for AI i steg 4.
- [ ] Faktisk gjennomføring og privat evaluering uten spillerprofiler.

## 4. AI og automatisering

- [ ] Vercel AI Gateway med strukturert, validert øktutkast.
- [ ] Kontekst fra planer, kilder, historikk og evalueringer.
- [ ] NFFs aldersriktige sportsplan/fagplan som standard forslag til årsplantemaer og øvingsmål, med faktisk kildekontroll og trenergodkjenning. Ikke generer dette før AI er på plass.
- [ ] Bruke planleggingskontrakten og versjonsflyten for AI-utkast/revisjoner; beregne ny gruppering ved endrede spiller-/trenerantall.
- [ ] Nettleserverktøy for Tiim, kildekontroll og tydelig feilrapportering.
- [ ] AI-revisjon med forhåndsvisning av endringer og versjonshistorikk.
- [ ] Planlagte jobber som lager utkast før trening, uten duplikater.
- [ ] Støtte for gjenbruk av økt i flere uker og individuell gjennomføring per dato.

## 5. Deling og medier

- [ ] Tilbakekallbare økt- og kalenderlenker uten utløp, med eksplisitt offentlig feltutvalg.
- [x] Integrere eksisterende taktikkredigerer og JSON-format i Next.js under Egne øvelser, med autorisert lokal levering og filimport/-eksport.
- [ ] Felles databaselagring av egne øvelser/animasjoner per gruppe og kobling til øktkort, med versjonering og tilgangskontroll.
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

Navigasjonsoppryddingen skiller oversikter fra administrasjon: klubbens grupper, brukere og profilinnstillinger har egne ruter. Gruppens fem menyvalg er Økter, Årsplan, Brukere, Innstillinger og Egne øvelser, samlet i slide-in-meny på mobil og venstre sidemeny på desktop. Økter viser kommende trening og siste lagrede økter; genereringsdato er tydelig merket som en inaktiv AI-plassholder. Årsplanen har et interaktivt årshjul og rullbar månedsoversikt. Animasjonseditoren gjenbruker eksisterende kode og JSON-format lokalt i appen, med filbasert lagring hos treneren inntil felles øvelsesbank er implementert. Oppretting av klubb, gruppe og enkeltøkt har dedikerte sider. Kalenderen nås fra Økter. Konto og utlogging er samlet i en egen meny.

Verifisert med 30 enhets-/animasjonstester, 26 databasekontroller, typekontroll, lint og produksjonsbygg. Nettleserkontrollen dekker seks hoved-/administrasjonssider ved 375 pikslers bredde, kalender, profil og enkeltøktskjema ved 320 piksler og klubboversikt ved 1280 piksler uten horisontal sideoverløp. Hamburgermenyen er kontrollert med tastatur, Escape, aktivt menyvalg og lukking ved navigasjon. Avviste skjemaer returnerer til riktig underside uten å opprette data.

Den lokale leveransen dekker punkt 1 og avkryssede deler av punkt 2 og 3. Lokal oppstart, engangsinnlogging, oppretting av klubb/gruppe, invitasjonsaksept og lagring av treningstider er testet i nettleser, inkludert mobilbredde og gjenlasting.

Byttet til PGlite og HeroUI er verifisert med 17 enhets-/animasjonstester og 8 databasekontroller, typekontroll, lint og produksjonsbygg. Nettlesertesten dekker HeroUI-skjemaer, ukedagsvalg med mus og tastatur, invitasjonsaksept, mobilvisning uten horisontal overløp og utlogging. Serveromstart bevarer både øktrammer, treningstider og innlogget sesjon i PGlite.

Utvidet rolleadministrasjon er verifisert med 17 enhets-/animasjonstester og 13 databasekontroller, typekontroll, lint og produksjonsbygg. Nye tester dekker administratorinvitasjonens utløp, engangsbruk, e-postbinding, erstatning og tilbakekalling, tilgang til klubbens øvrige grupper, tenant-grenser, bevaring av gruppemedlemskap og samtidige forespørsler om fratreden. Hovedtreneroverføring tester rollegrensene, medlemskravet, nedgradering av tidligere hovedtrener og tilbakekalling av gamle hovedtrenerinvitasjoner.

Nettleserkontrollen med isolerte, fiktive data dekker invitasjon og tilbakekalling, avvisning ved feil innlogget e-post, innlogging tilbake til administratorinvitasjonen, aksept, deaktivert knapp for siste administrator, rolleoverføring via HeroUI-valg og fratreden med bevart gruppetilgang. Klubb- og gruppesidene er kontrollert ved 375 pikslers bredde uten horisontal overløp. Eksisterende lokal database er ikke brukt til denne kontrollen.

Klubbprofilen har administratorstyrte primær-/aksentfarger og logoopplasting med lokal forhåndsvisning. Serveren håndhever kontrast og bildegrenser, skalerer/omkoder til WebP uten opprinnelige metadata og lagrer logoen i databasen. Verifisert med 23 enhets-/animasjonstester, 14 databasekontroller, typekontroll, lint og produksjonsbygg. Testene dekker filtypeforfalskning, korrupt bilde, animasjon, nøyaktige størrelses-/pikselgrenser, tomme filvalg, manglende administratorrettigheter, tenant-isolasjon, bevaring/fjerning av logo, tilbakestilling og persistens etter omstart.

Nettleserkontrollen av klubbprofilen bruker egen PGlite-database med fiktive klubber. Den dekker opplasting, forhåndsvisning uten lagring, valideringsfeil, fargeendring uten nytt logovalg, automatisk lys/mørk tekst, fjerning av bare logo og tilbakestilling. Farger/logo vises på klubbkort, klubb- og gruppesider uten å påvirke en annen klubb. Hovedtrener kan se profilen, men får ikke redigeringsskjema. Mobilkontrollen ved 375 piksler har ikke horisontal overløp. Offentlig profilvisning gjenstår sammen med delingssidene.

Typekontroll, lint, eksisterende animasjonstester, nye konfigurasjonstester, PGlite-integrasjonstester og produksjonsbygg er kontrollpunkter for leveransen. Databasetestene bruker isolerte midlertidige mapper, uten Docker eller miljøfil, og verifiserer fillås, persistens og at migreringer ikke kjøres på nytt ved omstart. HeroUI erstatter de håndlagde UI-komponentene uten å endre autorisasjonsreglene. `publiserte/assets/package.json` bevarer CommonJS-kompatibiliteten til de eksisterende UMD-baserte animasjonsmodulene mens webappen bruker ES-moduler.

Kalender og manuell øktplanlegging er verifisert med 29 enhets-/animasjonstester, 24 databasekontroller, typekontroll, lint og produksjonsbygg. Databasetestene dekker virtuelle uketider, samtidige/idempotente opprettinger, temaperioder, godkjenning, utdaterte redigeringer, tenant-grenser og sammensatte fremmednøkler. De tester også flytting over årsskiftet, avlysning/gjenåpning, bevaring av opprinnelig årsplankontekst og persistens etter ny åpning.

Fra-/til-tider er kontrollert med 30 enhets-/animasjonstester og 26 databasekontroller, typekontroll, lint og produksjonsbygg. Testene dekker ulike lengder på ukentlige treninger, serverstyrt arv ved kalenderoppretting, automatisk omberegning ved endring, tidsgrenser og midnatt. Oppgradering fra befolket eldre skjema bevarer varigheter og historiske verdier og kan kjøres på nytt uten endringer.

Nettleserkontrollen med en vanlig trener og isolerte, fiktive data dekker årsplan og temaperiode, aldersriktig NFF-lenke, kalender med arvede temaer, utkast og godkjenning, øvelsesrekkefølge/fjerning, versjonshistorikk, flytting og avlysning/gjenåpning. Avvist godkjenning bevarer tekstfelt, tekstområder, tall og øktdel. Årsplan, kalender og åpen øktbygger er kontrollert ved 375 pikslers bredde uten horisontal overløp. Ingen faktiske lagøkter er opprettet i Markdown-historikken.

Klubbfelles dokumenter/utstyr og faktisk gjennomføring/evaluering gjenstår i steg 3. AI, NFF-temagenerering, automatisk generering, Neon Auth og offentlig deling er fortsatt uferdige. Automatisk gruppering kommer sammen med AI; dagens tallkontroll gjør ikke om organiseringen på egen hånd. Avkrysning gjøres først når funksjonen er implementert og verifisert. Se også kjente utviklingsavhengighetsvarsler i [README](../README.md#verifisering-og-migreringer).
