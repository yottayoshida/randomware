#!/bin/bash
# Randomware prep: sweep candidate public APIs.
# Records HTTP status, content-type, latency, size, CORS header, and saves the body as a fixture.
set -u
OUT="${1:?usage: api_verify.sh <output-dir>}"
mkdir -p "$OUT/samples"
RESULTS="$OUT/results.tsv"
printf 'id\thttp\tcontent_type\ttime_s\tbytes\tcors\n' > "$RESULTS"

check() {
  id="$1"; url="$2"
  hdr="$OUT/samples/$id.headers"
  body="$OUT/samples/$id.json"
  res=$(curl -sS -m 12 -L \
        -H 'Origin: https://randomware-check.example' \
        -H 'Accept: application/json' \
        -A 'randomware-prep-check/0.1' \
        -D "$hdr" -o "$body" \
        -w '%{http_code}\t%{content_type}\t%{time_total}\t%{size_download}' \
        "$url" 2>"$OUT/samples/$id.err") || res=$'000\t-\t-\t0'
  cors=$(grep -i '^access-control-allow-origin:' "$hdr" 2>/dev/null | head -1 | tr -d '\r' | awk '{print $2}')
  printf '%s\t%s\t%s\n' "$id" "$res" "${cors:--}" >> "$RESULTS"
}

while IFS='|' read -r id url; do
  [ -z "$id" ] && continue
  check "$id" "$url" &
done <<'EOF'
deck-of-cards|https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1
poetrydb|https://poetrydb.org/random/1
datamuse|https://api.datamuse.com/words?ml=ocean&max=5
artic|https://api.artic.edu/api/v1/artworks?limit=2&fields=id,title,image_id,artist_title
met-museum|https://collectionapi.metmuseum.org/public/collection/v1/objects/436535
open-library|https://openlibrary.org/search.json?q=the%20moon&limit=2
rest-countries|https://restcountries.com/v3.1/name/japan?fields=name,capital,latlng,currencies,flags
dog-ceo|https://dog.ceo/api/breeds/image/random
radio-browser-de1|https://de1.api.radio-browser.info/json/stations/bycountry/japan?limit=2&hidebroken=true
open-meteo|https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.76&current=temperature_2m,weather_code,wind_speed_10m
frankfurter-dev|https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY,EUR
frankfurter-app|https://api.frankfurter.app/latest?from=USD&to=JPY
opentdb|https://opentdb.com/api.php?amount=2&type=multiple
wheretheiss|https://api.wheretheiss.at/v1/satellites/25544
advice-slip|https://api.adviceslip.com/advice
numbersapi-https|https://numbersapi.com/42/trivia?json
uselessfacts|https://uselessfacts.jsph.pl/api/v2/facts/random
catfact|https://catfact.ninja/fact
sunrise-sunset|https://api.sunrise-sunset.org/json?lat=35.6762&lng=139.6503
zippopotam|https://api.zippopotam.us/us/90210
nager-date|https://date.nager.at/api/v3/NextPublicHolidays/JP
tvmaze|https://api.tvmaze.com/search/shows?q=space
jikan|https://api.jikan.moe/v4/random/anime
quotable|https://api.quotable.io/random
bored|https://bored-api.appbrewery.com/random
wttr-in|https://wttr.in/Tokyo?format=j1
randomuser|https://randomuser.me/api/
pokeapi|https://pokeapi.co/api/v2/pokemon/pikachu
xkcd|https://xkcd.com/info.0.json
EOF
wait
n=$(($(wc -l < "$RESULTS") - 1))
echo "DONE: checked $n APIs -> $RESULTS"
