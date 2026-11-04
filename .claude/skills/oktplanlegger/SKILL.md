---
name: oktplanlegger
description: 'Planlegg fotballøkter og treningsøkter for G2017. Bruk når noen ber om en øktplan, trening, øvelser, tema eller progresjon for laget.'
argument-hint: 'Dato, økttype og eventuelle rammer for treningen'
---

# Øktplanlegger for G2017

Lag alderspassende, gjennomførbare fotballøkter med ett tema og en tydelig rød tråd fra oppvarming via temaarbeid til spill og avslutning. Skriv på norsk bokmål. Følg prosjektets `AGENTS.md` og arbeidsflyten i `README.md`; ved motstrid gjelder prosjektets gjeldende rammer og arbeidsflyt.

## 1. Les grunnlaget og avklar rammene

1. Les `AGENTS.md`, `README.md`, `docs/produktbeskrivelse.md`, `docs/rammer.md`, `docs/arbeidsflyt.md` og `maler/okt.md`.
2. Les `historikk/README.md`, de fire siste **gjennomførte** øktene av samme type og siste gjennomførte økt på samme tema. Følg lenkene og les evalueringene. Vurder også relevante erfaringer fra den andre økttypen, uten å forutsette at alle var på søndagsøkten. Hvis historikken er tom eller ufullstendig, oppgi det; ikke dikt opp tidligere aktivitet.
3. Avklar dato, økttype, varighet, forventede spillere, bekreftet treneroppmøte, tilgjengelige baller og mål og baneforhold. Skill klart mellom bekreftede fakta og planforutsetninger. Bruk bare de merkede standardforutsetningene i `docs/rammer.md` når de passer, og gjør det tydelig hva som må bekreftes. Ikke anta at alle ti trenere møter eller at det finnes én vinterball per spiller.

## 2. Undersøk NFF og Tiim

1. Beregn alder som øktår minus 2017, og åpne NFFs sportsplan for aktuell alder: [8–9 år](https://www.fotball.no/barn-og-ungdom/barn_8-9/), [10–11 år](https://www.fotball.no/barn-og-ungdom/barn_10-11/) eller [12 år](https://www.fotball.no/barn-og-ungdom/barn_12/). For andre aldre, finn riktig oppdatert sportsplan på fotball.no. Les aktuelle deler om trening og trenerrollen og noter hvilke råd som påvirker planen.
2. Bruk [Tiims økter og øvelser](https://tiim.no/okter-og-ovelser) som primærkilde. Velg Fotball og riktig aldersfilter: 8–9 år i 2026 og 10–12 år fra 2027 så lenge årskullet er i denne gruppen. Undersøk relevante temaer og øvelser, og åpne hver aktuell øvelsesside for å kontrollere aldersmerking og organisering. Les også `ovelsesbank/README.md` for tidligere kontrollerte kilder og lokale vurderinger.
3. Registrer nye kontrollerte kilder i øvelsesbanken etter bankens format, med lenke og kontrolldato. Skill mellom Tiims beskrivelse og lokale tilpasninger, og bruk kilde-ID eller lokal ID etter bankens regler.
4. Hvis en kilde ikke er tilgjengelig, oppgi hva som ikke lot seg kontrollere. Ikke finn på aldersmerking, øvelsesdetaljer eller NFF-anbefalinger, og ikke framstill en ukontrollert kilde som verifisert.

## 3. Velg tema og bygg en rød tråd

1. Bruk historikk, evalueringer, NFFs sportsplan, Tiim og dagens rammer til å velge ett hovedtema og ett eller to observerbare læringsmål. Begrunn valget kort, inkludert eventuell progresjon fra tidligere gjennomførte økter.
2. Velg aktiviteter som øver samme tema i ulike situasjoner. Beskriv hvordan oppvarming forbereder temaarbeidet, hvordan hovedaktiviteten utvikler ferdigheten, og hvordan spillerne får prøve den i spill. Avslutt med en kort oppsummering knyttet til læringsmålet.
3. Gjenbruk gjerne kjente øvelser, men følg kravet om variasjon i `docs/arbeidsflyt.md`: endre minst én hovedaktivitet eller gjør en meningsfull endring fra forrige økt av samme type. Begrunn bevisst gjentakelse. Marker alle lokale endringer fra Tiim og gi enklere og vanskeligere varianter.

## 4. Lag og kontroller øktplanen

1. For en konkret økt: kopier `maler/okt.md` til ny fil under `okter/AAAA/` etter navnekonvensjonen i `okter/README.md`. Fyll inn plan, kilder, læringsmål, trenerroller og referanse til tidligere økt ved gjenbruk. La tidligere planer og evalueringer stå urørt.
2. Fordel alle spillerne på samtidige grupper og beskriv rotasjon, bane, roller og venting. Summer tid inkludert forklaring, pauser og bytter. Regn ut aktive baller, eventuelle reserveballer og hvert målbehov for alle samtidige flater i hver blokk; oppgi største samtidige behov og eventuelle omrigginger. Sjekk dette mot bekreftet tilgjengelighet, ikke mot antatt beholdning.
3. Beskriv konkrete alternativer for endret oppmøte, færre trenere, færre baller og vinterforhold med nytt utstyrsbehov. Hvis avgjørende opplysninger mangler, marker planen og kontrollpunktene som uavklart og be om bekreftelse; påstå ikke at bemanning eller utstyr er kontrollert.
4. Følg ferdigkriteriene i `docs/produktbeskrivelse.md`. Registrer en konkret økt i `historikk/README.md` med status `planlagt` når planen er satt opp, og la faktisk oppmøte og gjennomføring stå tomt. Bruk bare status `gjennomført` når faktisk gjennomføring er oppgitt.

## 5. Publisering og tilbakemelding

- Lag en offentlig øktbeskrivelse med `maler/offentlig-okt.md` og følg GitHub Pages-rutinen i `docs/arbeidsflyt.md`. Publiser når tilgang og oppdrag tillater det, lagre faktisk lenke og test hele økten uten innlogging før status settes til `offentlig kontrollert`. Beskriv konkret hva som gjenstår hvis det ikke lykkes. Ikke publiser økten i Tiim.
- Oppsummer tema, rød tråd, lenke til øktfilen og eventuelle uavklarte forutsetninger. Skill mellom lokal plan, faktisk gjennomføring og publiseringsstatus. Offentlig økttekst skal bare inneholde treningsinnhold, ikke opplysninger om enkeltbarn.
- Hele GitHub-repositoriet er offentlig, også filer utenfor Pages. Ikke lagre ikke-offentlige opplysninger der.
