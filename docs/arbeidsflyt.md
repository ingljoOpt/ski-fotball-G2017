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

Taktikktavlene er egne illustrasjoner, ikke kopier av Tiims medier. De bygges fra JSON-filer og kan vise spillere, kjegler, ball og mål i ett stillbilde eller i flere animerte steg. De starter ikke automatisk. Lesere kan bruke ikonknappene til å spille av, pause og starte på nytt. Også ved innstillingen redusert bevegelse spilles animasjonen av når leseren aktivt velger det. Oppgi alltid en tekstlig øvelsesbeskrivelse, også for lesere som ikke kan se tavlen eller bruke JavaScript.

#### Rediger en tavle visuelt

1. Åpne den offentlige økten, utvid øvelsen og velg **Rediger denne tavlen**. Redigereren åpner den aktuelle JSON-filen. For en ny tavle kan du åpne [redigereren på Pages](https://ingljoopt.github.io/ski-fotball-G2017/rediger-taktikk.html) og velge **Ny tavle**. Du kan også åpne en tidligere nedlastet JSON-fil fra enheten.
2. Velg horisontal eller vertikal bane og visningsstørrelse liten, medium eller stor. Velg et steg med glidebryteren eller pilknappene, og velg en figur. Dra figuren på banen, bruk piltastene når den er valgt på banen, eller endre koordinatene. Shift og piltast flytter fem enheter. Flyttingen gjelder bare det valgte steget; figurer som legges til eller slettes, endres i alle steg. Småmål og store mål kan roteres i grader; rotasjonen gjelder alle steg.
3. Velg **Kopier til nytt steg** og flytt figurene. Legg inn mellomsteg for svinger: figurene beveger seg rett mellom punktene. Gjenta etter behov, og bruk avspillingsknappen ved glidebryteren til å kontrollere animasjonen fra valgt steg. Steg og figurer slettes umiddelbart.
4. Åpne **Vis avansert** for å endre beskrivelsene og tid per overgang, og velg **Last ned JSON**. Beskrivelsene brukes også av den offentlige tavlen og bør tilpasses innholdet. Endringene er ikke lagret i prosjektet eller publisert. Kopier den nedlastede filen til `publiserte/media/taktikk/`, og erstatt en eksisterende fil bare når dette er tilsiktet. En nedlastet fil kan åpnes igjen for videre redigering.
5. Oppdater tavlens tekstbeskrivelse i den offentlige øktfilen. For en ny tavle, legg inn taktikk-komponenten som vist nedenfor. Når en eksisterende datafil endres, øk versjonen i `src`-parameteren, for eksempel fra `?v=4` til `?v=5`, slik at nettlesere ikke bruker en gammel hurtigbufret fil.
6. Commit og push til GitHub, kontroller Pages-jobben og test den offentlige økten uten innlogging. Ingen GitHub-innlogging, opplasting eller automatisk publisering utføres av redigereren.

Redigereren lagrer ikke endringene automatisk. Last ned før du forlater siden; ved utskifting av en tavle eller når du forlater siden, varsles du om endringer som ikke er publisert. Ikke legg inn navn på enkeltbarn.

#### Rediger JSON direkte

1. Kopier [eksempelfilen](../publiserte/media/taktikk/firkant-pasning.json) til en ny JSON-fil i `publiserte/media/taktikk/`. Tilpass den til øvelsen og merk eventuelle lokale illustrasjonsvalg. Ikke bruk navn på enkeltbarn.
2. Skriv en `description` som forklarer illustrasjonen, og sett `durationMs` til tiden **per overgang** i millisekunder, fra 100 til 60000. Valgfritt `pitch` angir `orientation` (`horizontal` eller `vertical`) og visningsstørrelse `size` (`small`, `medium` eller `large`); uten feltet brukes horisontal og stor. Legg inn `objects` med unik `id`, `type` (`player`, `cone`, `ball`, `smallGoal` eller `goal`) og valgfri kort `label` på opptil tre tegn. Mål kan ha `rotation` i grader fra 0 til under 360, med klokken; rotasjonen gjelder alle steg.
3. Legg inn `frames` i ønsket rekkefølge. Hvert steg trenger en `caption` og `positions` med `[x, y]` for **alle** objekt-ID-er. Koordinater er tall fra 0 til 100: `x` øker mot høyre og `y` nedover. Figurene flyttes rett mellom punktene. Ett steg gir en statisk tavle; flere gir animasjon.
4. Legg følgende inn i Markdown-filen på ønsket sted, for eksempel inne i et øvelseskort. Bytt ut datafil, tittel og beskrivelse:

```liquid
{% include taktikk.html src="/media/taktikk/min-ovelse.json" title="Pasning og bevegelse" description="Forklar illustrasjonen kort." %}
```

Stien begynner med `/media/`, men komponenten legger selv til GitHub Pages-prosjektets basesti. Lagre JSON-filen under `publiserte/media/` og bruk en fil som faktisk finnes. Flere tavler på samme side kan bruke forskjellige filer.

Kjør `node --test tests\taktikk.test.cjs tests\taktikk-rediger.test.cjs` for å kontrollere tavleformatet og redigeringsoperasjonene. Etter publisering må du åpne økten, kontrollere at tavlen vises og at avspilling og pause fungerer. Feil i data eller manglende fil vises i stedet for tavlen; kontroller nettleserkonsollen for detaljer.

## Etter trening

Behold planlagt innhold og før faktisk oppmøte, hvilke aktiviteter som ble gjennomført, tidsendringer og erfaringer i evalueringsdelen. Sett status til `gjennomført` og oppdater historikken. Ved avlysning brukes `avlyst` med kort årsak.

En gjennomført økt skal beholde innholdet som faktisk ble brukt. Ved gjenbruk kopieres den til ny dato og får ny ID med referanse til originalen. Den historiske øktfilen skal fortsatt vise den faktiske gjennomføringen.
