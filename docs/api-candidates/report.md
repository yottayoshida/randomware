# Public API Candidate Verification

Verified: **2026-07-18**, from Tokyo, one live GET per API via [`verify.sh`](verify.sh) (curl, 12s timeout, `Origin` header set so servers reveal their CORS policy), plus manual retests for borderline cases. Raw results: [`results.tsv`](results.tsv). A second round the same day tested 7 additional candidates chosen for collision value under the PRD's creative principles (history, earthquakes, food, music, dictionary, space); raw results: [`results-round2.tsv`](results-round2.tsv). Captured response bodies and headers: [`samples/`](samples/).

## What was checked

- HTTPS reachability and status code
- JSON content type
- CORS (`Access-Control-Allow-Origin`) — only relevant if the browser calls the API directly; a server-side proxy makes it irrelevant, so a missing CORS header demotes an API rather than rejects it
- Latency (single sample per API — indicative, not a benchmark)
- Rate-limit headers where present

## Primary set (17)

Chosen for health, speed, category diversity (visual / audio / geo / realtime / text / numbers / games / knowledge / history / food), and **collision value** — how strange the pairings this API can produce are, per the PRD's creative principles.

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
| 11 | `advice-slip` | Advice Slip | text / playful | 0.82s | `*` | Responses cached ~2s server-side |
| 12 | `pokeapi` | PokéAPI | game characters / rich data | 0.29s | `*` | ~290KB per Pokémon — must trim/limit fields |
| 13 | `randomuser` | RandomUser | identity / persona | 0.28s | `*` | Generated fake identities (no real PII) |
| 14 | `wiki-onthisday` | Wikipedia On This Day | history / culture | 0.63s | `*` | ~160KB payloads — sample/trim events server-side |
| 15 | `usgs-quakes` | USGS Earthquakes | realtime / geo | 0.57s | `*` | `all_day` feed ~190KB; magnitude-filtered feeds are smaller |
| 16 | `themealdb` | TheMealDB | food / images | 0.60s | `*` | Free dev key `1`; confirm demo-use terms during design pass |
| 17 | `itunes-search` | iTunes Search | music / audio previews | 0.33s | echo | 30s audio preview URLs; returns JSON with `text/javascript` content type — mediation layer must tolerate this |

## Backup set (14)

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
| `opentdb` | Open Trivia DB | 0.84s | Demoted from primary: trivia data invites the banned plain-quiz shape; lower collision value. `response_code` envelope |
| `sunrise-sunset` | Sunrise-Sunset | 0.28s | Demoted from primary: thin single-purpose data |
| `thecocktaildb` | TheCocktailDB | 0.60s | Same provider and shape as TheMealDB; use for variety only |
| `dictionaryapi` | Free Dictionary API | 0.59s | Overlaps Datamuse; has pronunciation audio URLs |
| `open-notify-astros` | Open Notify (people in space) | 0.24s | **HTTP-only** → proxy only; "who is in space right now" |

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

## Round 3 — replacement-axis candidates (2026-07-18)

After the design pass excluded several primaries on terms/safety grounds, six candidates were live-checked to recover the lost collision axes (food, fictional characters, books, second audio source). Raw results: [`results-round3.tsv`](results-round3.tsv); fixtures in [`samples/`](samples/).

| id | API | Axis | Latency | CORS | Verdict / notes |
|----|-----|------|---------|------|-----------------|
| `rickandmorty` | Rick and Morty API | characters | 0.39s | `*` | Healthy; images on its own domain (bounded assets). Terms verification pending |
| `open-food-facts` | Open Food Facts | food | 0.70s | — | Healthy via light product endpoints with `fields`; the heavy v2 search endpoint returned an empty reply — avoid it. Images on `images.openfoodfacts.org` (bounded). ODbL attribution required |
| `foodish` | Foodish | food images | 0.57s | `*` | Healthy but data-thin (random food image URL only); own-domain images |
| `librivox` | LibriVox | books + audio | 0.44s | none | Healthy; public-domain audiobooks with audio files on `archive.org` (bounded). Proxy-only (no CORS) |
| `deezer` | Deezer search/previews | audio | 0.39s | none | Healthy; 30s preview URLs. Music-preview terms risk is the same class that excluded iTunes — expect rejection |
| `gutendex` | Gutendex (Project Gutenberg) | books | 6.3–13.8s uncached, 0.1s cached | `*` | Reject for the core path: uncached queries are slower than the Open Library latency that caused its exclusion |

## Round 4 — bounded visual/data candidates (2026-07-19)

Each candidate received at most one bounded implementation probe (10 seconds, 200,000 raw bytes, no retry). Only evidence-backed entries were added.

| id | API | Result | Raw evidence | Decision / constraints |
|----|-----|--------|--------------|------------------------|
| `gbif` | [GBIF occurrence search](https://techdocs.gbif.org/en/openapi/) | timeout | No response within 10 seconds; no fixture written | Reject. Do not retry or fabricate an entry; publisher-controlled occurrence media would also be stripped rather than proxied if reconsidered. |
| `nasa-images` | [NASA Image and Video Library](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf) | HTTP 200 in 619 ms | 4,289-byte JSON fixture | Promote. Fixed `PIA12348` image search; ignore the insecure collection link and expose only the HTTPS rendered image at `items.*.imageUrl`, bound to `images-assets.nasa.gov`. |
| `loc-photos` | [Library of Congress Photos](https://www.loc.gov/apis/json-and-yaml/) | HTTP 200 in 1,725 ms | 72,251-byte JSON fixture | Promote. Fixed `q=moon&fo=json&c=2`; the captured image path resolves only to `tile.loc.gov`. Five-minute cache and 240/day budget remain far below the published 20 requests/minute guidance. |
| — | iNaturalist | owner-excluded | 51.6 MB in 8.1 seconds for the measured raw observations response | Reject before implementation: unbounded for the registry contract. |

The resulting launch registry has 20 entries, not 21: GBIF failed the explicit bounded probe and was not retried. NASA and LOC have raw fixtures, production-adapted goldens, model-visible response examples, exact asset paths/hosts, policy metadata, symbols, selector participation, and health checks.
