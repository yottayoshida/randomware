# Public API Candidate Verification

Verified: **2026-07-18**, from Tokyo, one live GET per API via [`verify.sh`](verify.sh) (curl, 12s timeout, `Origin` header set so servers reveal their CORS policy), plus manual retests for borderline cases. Raw results: [`results.tsv`](results.tsv). Captured response bodies and headers: [`samples/`](samples/).

## What was checked

- HTTPS reachability and status code
- JSON content type
- CORS (`Access-Control-Allow-Origin`) — only relevant if the browser calls the API directly; a server-side proxy makes it irrelevant, so a missing CORS header demotes an API rather than rejects it
- Latency (single sample per API — indicative, not a benchmark)
- Rate-limit headers where present

## Primary set (15)

Chosen for health, speed, and category diversity (visual / audio / geo / realtime / text / numbers / games / knowledge).

| # | id | API | Category | Latency | CORS | Notes |
|---|----|-----|----------|---------|------|-------|
| 1 | `deck-of-cards` | Deck of Cards | games / state | 0.76s | `*` | Stateful deck sessions (draw, shuffle, piles) |
| 2 | `poetrydb` | PoetryDB | text / culture | 0.91s | `*` | Random or filtered classic poems |
| 3 | `datamuse` | Datamuse | words / text | 0.47s | echo | Semantic word search; CORS echoes Origin (fine) |
| 4 | `artic` | Art Institute of Chicago | art / images | 1.04s | `*` | Search + IIIF image URLs |
| 5 | `open-library` | Open Library | books / knowledge | 3.4s | `*` | Slowest primary; keep queries small |
| 6 | `rest-countries` | REST Countries | geo / knowledge | 0.59s | `*` | v3.1 requires `fields` param (huge payloads otherwise) |
| 7 | `dog-ceo` | Dog CEO | images / animals | 2.7s | `*` | Breed list + random images |
| 8 | `radio-browser` | Radio Browser | audio / realtime | 0.98s | `*` | Tested `de1` mirror; production should resolve mirrors properly |
| 9 | `open-meteo` | Open-Meteo | weather / geo | 1.07s | `*` | Forecast by coordinates, no key |
| 10 | `frankfurter` | Frankfurter | currency / numbers | 0.75s | `*` | Both `api.frankfurter.dev` (v1) and `.app` healthy |
| 11 | `opentdb` | Open Trivia DB | trivia / games | 0.84s | `*` | Note `response_code` envelope |
| 12 | `advice-slip` | Advice Slip | text / playful | 0.82s | `*` | Responses cached ~2s server-side |
| 13 | `pokeapi` | PokéAPI | game characters / rich data | 0.29s | `*` | ~290KB per Pokémon — must trim/limit fields |
| 14 | `randomuser` | RandomUser | identity / persona | 0.28s | `*` | Generated fake identities (no real PII) |
| 15 | `sunrise-sunset` | Sunrise-Sunset | time / geo | 0.28s | `*` | Solar times by coordinates |

## Backup set (9)

Healthy; use if a primary degrades or more variety is wanted.

| id | API | Latency | Notes |
|----|-----|---------|-------|
| `met-museum` | Metropolitan Museum of Art | 0.53s | Overlaps `artic`; second art source |
| `zippopotam` | Zippopotam | 0.33s | Postal code → place/coordinates |
| `nager-date` | Nager.Date | 0.37s | Public holidays by country |
| `tvmaze` | TVMaze | 1.13s | TV show search |
| `catfact` | Cat Facts (catfact.ninja) | 0.32s | Rate limit 100/min observed |
| `uselessfacts` | Useless Facts | 1.32s | Random facts |
| `xkcd` | xkcd | 0.60s | **No CORS** → proxy only |
| `bored` | Bored API (appbrewery mirror) | 0.43s | **No CORS** → proxy only; rate limit 100 observed |
| `wheretheiss` | Where The ISS At | 9–10s | See ISS note below |

## Rejected (4)

| id | Reason |
|----|--------|
| `numbersapi` | No working HTTPS endpoint (HTTPS returns 404/HTML) |
| `quotable` | TLS connection failure (known expired-certificate issue) |
| `jikan` | HTTP 504 on 3 consecutive attempts |
| `wttr.in` | Serves JSON as `text/plain`, ~40KB payloads, known overload issues |

## ISS note

ISS position is flagship demo material ("Orbital Poet"-style concepts). Two options were measured:

- `api.wheretheiss.at` — HTTPS, healthy, rate limit 350 req/5min, but **consistently 9–10s per request** (4 samples: 9.0–10.4s). Unacceptable on the core demo path.
- `api.open-notify.org` — fast (0.4s) but **HTTP-only**, so usable only through a server-side proxy.

Recommendation: if ISS stays in the registry, serve it via open-notify behind the proxy with wheretheiss as fallback; otherwise drop ISS from the primary set (already excluded above).

## Rate limits observed

`wheretheiss` 350 req / 5 min; `catfact` 100; `bored` 100. Others exposed no rate-limit headers on a single request — assume unpublished limits exist and cap per-creation request counts regardless.

## Caveats

- Single-shot checks from one network on one day. Health must be rechecked at implementation time and reflected in the registry's verification status.
- Latency figures are indicative only (single sample, one location).
- Terms-of-service and attribution review per API is still open and must be completed during the design pass.
