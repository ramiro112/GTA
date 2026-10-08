#!/bin/sh
# Führt alle automatisierten Tests aus: Unit-Tests + Browser-Szenarien.
cd "$(dirname "$0")/.."
echo "== Unit-Tests =="; npm test 2>&1 | grep -E "^# (pass|fail)"
for s in basic bugcheck aircraft startkit vehicles boat garage weapons ai police flight missions ui playthrough stress; do
  printf "== %s: " "$s"
  timeout 900 node tests/smoke.mjs "$s" > "tests/output_$s.log" 2>&1 && echo "ok" || { echo "FEHLER"; tail -5 "tests/output_$s.log"; }
done
