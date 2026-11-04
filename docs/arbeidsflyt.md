# Arbeidsflyt for treningsøkter

## Før planlegging

Les lagets rammer og de fire siste gjennomførte øktene av samme type, pluss siste økt på samme tema. Hvis historikken er tom, registrer dette og start fra dagens forutsetninger. Bruk faktisk gjennomføring som grunnlag for gjenbruk, ikke bare den opprinnelige planen.

Avklar dato, varighet, forventet antall spillere og trenere, tilgjengelige baller og mål samt forhold på banen. Bruk og oppgi planforutsetninger når opplysninger mangler. Tildel én øktansvarlig og konkrete roller for de trenerne som er forventet til stede.

## Sett sammen økten

1. Velg ett hovedtema og ett eller to observerbare læringsmål.
2. Åpne [Tiim](https://tiim.no/okter-og-ovelser), velg aldersfilter for årskullet og Fotball. Velg deretter tema og øvelsestype ved behov.
3. Velg øvelser med egnet ballbehov og organisering. Kontroller selve øvelsessiden og legg nye kilder i øvelsesbanken.
4. Kopier øktmalen til årsmappe under `okter/`. Sett opp tidsplan, grupper, trenerroller, bane og samlet utstyr.
5. Merk lokale tilpasninger og lag en variant ved færre baller, endret oppmøte eller vinterforhold.
6. Sjekk kravene i prosjektbeskrivelsen, og registrer økten som `planlagt` i historikken.

## Variasjon og progresjon

Bruk gjerne en kjent øvelse som spillerne forstår. Som lokal standard bør neste økt av samme type endre minst én hovedaktivitet eller gjøre en meningsfull endring i en kjent hovedaktivitet. Endringen kan være ny spillsituasjon, målplassering, motstand eller organisering; et nytt navn alene gir ikke variasjon.

La gjerne samme tema gå over flere treninger med progresjon. Noter forrige økt-ID og hva som videreføres eller endres. Gjenta en hel økt når det er et bevisst valg, og forklar hvorfor. Juster etter evaluering og unngå å endre alle reglene på én gang.

## Publiser med GitHub Pages

Tiim er fortsatt kilde for øvelser, men økter opprettes ikke i Tiim for deling. Den offentlige nettsiden bygges bare fra `publiserte/`; kildefilene og hele resten av GitHub-repositoriet er likevel offentlig lesbare. Ikke lagre opplysninger om enkeltbarn, interne evalueringer eller annet ikke-offentlig innhold i repositoriet.

### Oppsett én gang

1. Legg prosjektendringene på GitHub i `main`. I repositoriets **Settings → Pages**, velg **GitHub Actions** som kilde. Dette krever passende tilgang til repositoriet.
2. Kjør arbeidsflyten **Publiser økter** manuelt under Actions hvis den ikke allerede har kjørt etter at Pages ble konfigurert.
3. Kontroller at bygg og publisering lykkes. Bruk den faktiske nettstedadressen fra Pages-innstillingene eller arbeidsflyten; ikke anta at en adresse er aktiv før den er kontrollert.

Arbeidsflyten `pages.yml` bygger Markdown og HTML i `publiserte/` med Jekyll og publiserer bare det ferdige nettstedet. Endringer i denne mappen på `main` starter en ny publisering. Se [GitHubs dokumentasjon om Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### For hver økt

1. Ferdigstill øktplanen i `okter/` og kopier `maler/offentlig-okt.md` til `publiserte/okter/AAAA/AAAA-MM-DD-onsdag-tema.md` eller tilsvarende for søndag. Behold YAML-feltene øverst og oppgi en beskrivende tittel.
2. Ta med treningsinnhold, læringsmål, rekkefølge, varighet, organisering, lokale tilpasninger og lenker til Tiim-kildene. Malen gir økten en topp med nøkkelinformasjon, oversikt og utfellbare øvelseskort. Fyll inn feltene i toppen og bruk en unik `id` per kort som lenkene i oversikten peker til. Kopier kort og øktdeler ved behov. Ikke ta med faktisk oppmøte eller evaluering i den offentlige øktbeskrivelsen. Oppdater beskrivelsen hvis planen endres før trening; bevar den historiske planen og evalueringen ved senere gjenbruk.
3. Legg til eventuelle medier som beskrevet nedenfor. Når endringene er lagt på `main`, kontroller arbeidsflyten i GitHub Actions. Finn økten fra nettstedets forside.
4. Lagre den **faktiske** GitHub Pages-lenken og publiseringsstatusen i øktfilen og historikken. Åpne lenken uten innlogging og kontroller tekst, lenker og eventuelle medier. Først da settes status til `offentlig kontrollert` med kontrolldato.

Hvis tilgang, bygging eller publisering ikke lykkes, behold planen og beskriv konkret hva som gjenstår. En lokal fil eller en lagret commit er ikke en kontrollert offentlig økt. Ikke finn på lenker.

### Bilder, animasjoner og video

Lagre egne medier eller medier med uttrykkelig tillatelse under `publiserte/media/`, og lenk til dem relativt fra øktfilen. For en økt i `publiserte/okter/AAAA/` kan for eksempel en animasjon legges inn slik:

```markdown
![Beskrivelse av øvelsen](../../media/ovelse.gif)
```

Video kan spilles av på Pages-siden med HTML i Markdown. Velg en faktisk fil og gi også en vanlig lenke:

```html
<video controls preload="metadata" width="640">
  <source src="../../media/ovelse.mp4" type="video/mp4">
  Nettleseren støtter ikke video. <a href="../../media/ovelse.mp4">Åpne videoen</a>.
</video>
```

En ekstern video kan eventuelt bygges inn med leverandørens `iframe` hvis leverandøren tillater det; legg til tittel og en vanlig lenke som alternativ, og test visningen. GitHubs vanlige Markdown-visning og Pages kan håndtere HTML ulikt; kontroller derfor den publiserte Pages-siden. Ikke kopier Tiim-videoer eller andre medier uten nødvendige rettigheter; lenk heller til kilden. Ta hensyn til personvern og samtykke ved opptak.

### Taktikktavler

Taktikktavlene er egne illustrasjoner, ikke kopier av Tiims medier. De bygges fra JSON-filer og kan vise spillere, kjegler og ball i ett stillbilde eller i flere animerte steg. De starter ikke automatisk. Lesere kan spille av, pause og starte på nytt; ved innstillingen redusert bevegelse vises stegene ett om gangen. Oppgi alltid en tekstlig øvelsesbeskrivelse, også for lesere som ikke kan se tavlen eller bruke JavaScript.

1. Kopier [eksempelfilen](../publiserte/media/taktikk/firkant-pasning.json) til en ny JSON-fil i `publiserte/media/taktikk/`. Tilpass den til øvelsen og merk eventuelle lokale illustrasjonsvalg. Ikke bruk navn på enkeltbarn.
2. Skriv en `description` som forklarer illustrasjonen, og sett `durationMs` til tiden **per overgang** i millisekunder, fra 100 til 60000. Legg inn `objects` med unik `id`, `type` (`player`, `cone` eller `ball`) og valgfri kort `label` på opptil tre tegn.
3. Legg inn `frames` i ønsket rekkefølge. Hvert steg trenger en `caption` og `positions` med `[x, y]` for **alle** objekt-ID-er. Koordinater er tall fra 0 til 100: `x` øker mot høyre og `y` nedover. Figurene flyttes rett mellom punktene. Ett steg gir en statisk tavle; flere gir animasjon.
4. Legg følgende inn i Markdown-filen på ønsket sted, for eksempel inne i et øvelseskort. Bytt ut datafil, tittel og beskrivelse:

```liquid
{% include taktikk.html src="/media/taktikk/min-ovelse.json" title="Pasning og bevegelse" description="Forklar illustrasjonen kort." %}
```

Stien begynner med `/media/`, men komponenten legger selv til GitHub Pages-prosjektets basesti. Lagre JSON-filen under `publiserte/media/` og bruk en fil som faktisk finnes. Flere tavler på samme side kan bruke forskjellige filer. Dette er et databasert rammeverk, ikke en grafisk redigerer.

Kjør `node --test tests\taktikk.test.cjs` for å kontrollere validering og interpolering. Etter publisering må du åpne økten, kontrollere at tavlen vises og at avspilling og pause fungerer. Feil i data eller manglende fil vises i stedet for tavlen; kontroller nettleserkonsollen for detaljer.

## Etter trening

Behold planlagt innhold og før faktisk oppmøte, hvilke aktiviteter som ble gjennomført, tidsendringer og erfaringer i evalueringsdelen. Sett status til `gjennomført` og oppdater historikken. Ved avlysning brukes `avlyst` med kort årsak.

En gjennomført økt skal beholde innholdet som faktisk ble brukt. Ved gjenbruk kopieres den til ny dato og får ny ID med referanse til originalen. Den historiske øktfilen skal fortsatt vise den faktiske gjennomføringen.
