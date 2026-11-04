# Øktplanlegging for G2017

Prosjektet skal gjøre det enkelt å lage varierte, gjennomførbare fotballøkter for gutter født i 2017. Tiim brukes som øvelseskilde; øktene lagres i GitHub og kan deles via GitHub Pages. Denne prosjektmappen samler rammer, lokale tilpasninger og historikk.

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
| `docs/rammer.md` | Spillergruppe, utstyr, årstid og organisering |
| `docs/arbeidsflyt.md` | Planlegging, kilder, GitHub-publisering og gjenbruk |
| `ovelsesbank/README.md` | Verifiserte Tiim-lenker og lokale vurderinger |
| `maler/okt.md` | Plan, utstyrsregnskap og evaluering i én fil |
| `maler/offentlig-okt.md` | Mal for offentlig øktbeskrivelse |
| `maler/periodeplan.md` | Tema og progresjon over flere uker |
| `okter/README.md` | Navngiving og lagring av økter |
| `historikk/README.md` | Register over planlagte og gjennomførte økter |
| `AGENTS.md` | Instruksjoner til framtidig arbeid i prosjektet |
| `.claude/skills/oktplanlegger/SKILL.md` | Felles agentferdighet for temabasert øktplanlegging |
| `publiserte/` | Markdown og medier for GitHub Pages |
| `.github/workflows/pages.yml` | Bygging og publisering av nettstedet |

Repositoriet er offentlig: også filer utenfor nettstedet kan leses på GitHub. Ikke lagre opplysninger om enkeltbarn eller annet ikke-offentlig innhold her. Ingen tidligere treninger er registrert per 4. november 2026.
