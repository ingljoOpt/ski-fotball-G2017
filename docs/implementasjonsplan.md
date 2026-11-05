# Implementasjonsplan for klubbøkter

Kravgrunnlag: [nettsted-spesifikasjon](nettsted-spesifikasjon.md).

## 1. Kjørbart lokalt fundament

- [x] Next.js med TypeScript, norsk grensesnitt og responsiv navigasjon.
- [x] HeroUI v3 og Tailwind CSS v4 på eksisterende sider, med tilgjengelige skjemaetiketter og innsendingstilstand.
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
- [x] Gruppens faste treningstider, øktlengde og antall dager før automatisk oppretting lagres. Selve automatikkjobben kommer i steg 4.
- [x] Flere klubbadministratorer og overføring av hovedtrenerrolle, med e-postbundet invitasjon/tilbakekalling, vern av siste administrator og atomisk rollebytte til eksisterende gruppemedlem.
- [x] Klubbprofil: klubbadministrator kan laste opp logo og velge primær-/aksentfarger, med forhåndsvisning, validering og tilbakestilling til standard.
- [x] Bruke klubbprofil på klubbkort, klubb- og gruppesider; kontrollere kontrast, logoens tekstalternativ og isolasjon mellom klubber.
- [ ] Bruke den delte klubbprofilkomponenten på offentlige økt-/kalendersider når disse implementeres i steg 5.
- [x] Autorisasjonstester for første leveranses klubb-, gruppe- og rollegrenser.

## 3. Kalender og manuell øktplanlegging

- [ ] Kalender med gjentakende treninger, unntak og enkeltøkter.
- [ ] Års-/periodeplan med tema og progresjon.
- [ ] Klubbfelles sportsplan, veiledning og utstyr med versjonering.
- [ ] Manuelle øktutkast, øvelseskort og uforanderlige planversjoner.
- [ ] Oppmøteforutsetninger og kontroller av tid, trenerbehov og samtidig utstyr.
- [ ] Faktisk gjennomføring og privat evaluering uten spillerprofiler.

## 4. AI og automatisering

- [ ] Vercel AI Gateway med strukturert, validert øktutkast.
- [ ] Kontekst fra planer, kilder, historikk og evalueringer.
- [ ] Nettleserverktøy for Tiim, kildekontroll og tydelig feilrapportering.
- [ ] AI-revisjon med forhåndsvisning av endringer og versjonshistorikk.
- [ ] Planlagte jobber som lager utkast før trening, uten duplikater.
- [ ] Støtte for gjenbruk av økt i flere uker og individuell gjennomføring per dato.

## 5. Deling og medier

- [ ] Tilbakekallbare økt- og kalenderlenker uten utløp, med eksplisitt offentlig feltutvalg.
- [ ] Integrere eksisterende taktikkredigerer og JSON-format i Next.js.
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

Første lokale leveranse dekker punkt 1 og avkryssede deler av punkt 2. Lokal oppstart, engangsinnlogging, oppretting av klubb/gruppe, invitasjonsaksept og lagring av treningstider er testet i nettleser, inkludert mobilbredde og gjenlasting.

Byttet til PGlite og HeroUI er verifisert med 17 enhets-/animasjonstester og 8 databasekontroller, typekontroll, lint og produksjonsbygg. Nettlesertesten dekker HeroUI-skjemaer, ukedagsvalg med mus og tastatur, invitasjonsaksept, mobilvisning uten horisontal overløp og utlogging. Serveromstart bevarer både øktrammer, treningstider og innlogget sesjon i PGlite.

Utvidet rolleadministrasjon er verifisert med 17 enhets-/animasjonstester og 13 databasekontroller, typekontroll, lint og produksjonsbygg. Nye tester dekker administratorinvitasjonens utløp, engangsbruk, e-postbinding, erstatning og tilbakekalling, tilgang til klubbens øvrige grupper, tenant-grenser, bevaring av gruppemedlemskap og samtidige forespørsler om fratreden. Hovedtreneroverføring tester rollegrensene, medlemskravet, nedgradering av tidligere hovedtrener og tilbakekalling av gamle hovedtrenerinvitasjoner.

Nettleserkontrollen med isolerte, fiktive data dekker invitasjon og tilbakekalling, avvisning ved feil innlogget e-post, innlogging tilbake til administratorinvitasjonen, aksept, deaktivert knapp for siste administrator, rolleoverføring via HeroUI-valg og fratreden med bevart gruppetilgang. Klubb- og gruppesidene er kontrollert ved 375 pikslers bredde uten horisontal overløp. Eksisterende lokal database er ikke brukt til denne kontrollen.

Klubbprofilen har administratorstyrte primær-/aksentfarger og logoopplasting med lokal forhåndsvisning. Serveren håndhever kontrast og bildegrenser, skalerer/omkoder til WebP uten opprinnelige metadata og lagrer logoen i databasen. Verifisert med 23 enhets-/animasjonstester, 14 databasekontroller, typekontroll, lint og produksjonsbygg. Testene dekker filtypeforfalskning, korrupt bilde, animasjon, nøyaktige størrelses-/pikselgrenser, tomme filvalg, manglende administratorrettigheter, tenant-isolasjon, bevaring/fjerning av logo, tilbakestilling og persistens etter omstart.

Nettleserkontrollen av klubbprofilen bruker egen PGlite-database med fiktive klubber. Den dekker opplasting, forhåndsvisning uten lagring, valideringsfeil, fargeendring uten nytt logovalg, automatisk lys/mørk tekst, fjerning av bare logo og tilbakestilling. Farger/logo vises på klubbkort, klubb- og gruppesider uten å påvirke en annen klubb. Hovedtrener kan se profilen, men får ikke redigeringsskjema. Mobilkontrollen ved 375 piksler har ikke horisontal overløp. Offentlig profilvisning gjenstår sammen med delingssidene.

Typekontroll, lint, eksisterende animasjonstester, nye konfigurasjonstester, PGlite-integrasjonstester og produksjonsbygg er kontrollpunkter for leveransen. Databasetestene bruker isolerte midlertidige mapper, uten Docker eller miljøfil, og verifiserer fillås, persistens og at migreringer ikke kjøres på nytt ved omstart. HeroUI erstatter de håndlagde UI-komponentene uten å endre autorisasjonsreglene. `publiserte/assets/package.json` bevarer CommonJS-kompatibiliteten til de eksisterende UMD-baserte animasjonsmodulene mens webappen bruker ES-moduler.

Neon Auth, AI, kalender, automatisk generering og offentlig deling er fortsatt uferdige. Neste implementasjonssteg er kalender og manuell øktplanlegging, deretter AI og automatisering. Avkrysning gjøres først når funksjonen er implementert og verifisert. Se også kjente utviklingsavhengighetsvarsler i [README](../README.md#verifisering-og-migreringer).
