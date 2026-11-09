#!/bin/bash
# Test de bout en bout de TrackR depuis ops01 (connexions, droits, saisie).
#   bash scripts/test-trackr.sh
set -u
cd /srv/infra/ansible
U=https://trackr.transnord.lan
PW=$(ansible localhost -m debug -a var=vault_users_initial_password 2>/dev/null | awk '/vault_users_initial_password/ {print $2}')
PP=$(ansible localhost -m debug -a var=vault_prestataires_password 2>/dev/null | awk '/vault_prestataires_password/ {print $2}')
J=$(mktemp -d)

login() {  # $1 identifiant, $2 mot de passe -> code + message
  rm -f "$J/$1"
  curl -s -c "$J/$1" -b "$J/$1" -o "$J/out" -w '%{http_code}' -d "login=$1" --data-urlencode "password=$2" "$U/login"
  grep -o 'class="error">[^<]*' "$J/out" | sed 's/class="error">/ /'
}
ok()  { echo "  OK   $*"; }
ko()  { echo "  ÉCHEC $*"; FAIL=1; }
FAIL=0

echo "== Santé";  curl -s "$U/health"; echo
echo "== Agent de quai (j.moreau) : connexion + saisie"
[ "$(login j.moreau "$PW")" = "302" ] && ok "connexion" || ko "connexion"
ID=$(cat /proc/sys/kernel/random/uuid)
BODY="{\"id\":\"$ID\",\"kind\":\"arrivee\",\"plate\":\"AB-123-CD\",\"reference\":\"EXP-TEST-1\",\"quay\":\"Q3\",\"scheduled_at\":\"$(date -u -d '-40 min' +%FT%TZ)\",\"actual_at\":\"$(date -u +%FT%TZ)\"}"
C1=$(curl -s -b "$J/j.moreau" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H 'X-Requested-With: trackr' -d "$BODY" "$U/api/events")
C2=$(curl -s -b "$J/j.moreau" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H 'X-Requested-With: trackr' -d "$BODY" "$U/api/events")
[ "$C1" = 201 ] && [ "$C2" = 200 ] && ok "saisie créée puis renvoi sans doublon ($C1/$C2)" || ko "saisie ($C1/$C2)"
curl -s -b "$J/j.moreau" "$U/api/events" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  résumé du jour :", d["summary"], "- servi par", d["node"])'

echo "== Comptable (c.martin) : lecture seule"
[ "$(login c.martin "$PW")" = "302" ] && ok "connexion" || ko "connexion"
C=$(curl -s -b "$J/c.martin" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H 'X-Requested-With: trackr' -d "$BODY" "$U/api/events")
[ "$C" = 403 ] && ok "saisie refusée (403)" || ko "saisie devait être refusée ($C)"

echo "== RH (s.lefebvre) : aucun accès à TrackR"
R=$(login s.lefebvre "$PW"); [[ "$R" == 200* ]] && ok "refusé :$( echo "$R" | cut -c4-)" || ko "$R"

echo "== Prestataire en mission (p.dupont)"
[ "$(login p.dupont "$PP")" = "302" ] && ok "connexion" || ko "connexion"
curl -s -b "$J/p.dupont" "$U/api/events" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  OK   noms des salariés masqués :", all(e["recorded_by"] is None for e in d["events"]))'

echo "== Prestataire dont la mission est finie (k.lambert)"
R=$(login k.lambert "$PP"); [[ "$R" == 200* ]] && ok "refusé :$( echo "$R" | cut -c4-)" || ko "$R"

echo "== Mot de passe faux"
R=$(login j.moreau "mauvais"); [[ "$R" == 200* ]] && ok "refusé" || ko "$R"

rm -rf "$J"
exit $FAIL
