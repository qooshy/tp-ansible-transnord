#!/bin/bash
# Les 3 démos de la soutenance, enchaînées : ESPACE pour passer à la suite.
# Relançable : la préparation remet la liaison en service et vide la boîte mail.
# Depuis le PC (PowerShell, dossier lab) :
#   vagrant ssh ctl -- -t "bash /srv/loginord/lab/demo.sh"
set -uo pipefail
cd /srv/loginord
D="bash lab/deploy.sh"
MAIL="http://10.0.2.2:8025/api/v1/messages"        # boîte mail des alertes (via le PC)

titre()  { echo; echo "--- $*"; }
info()   { echo "    $*"; }
espace() { echo; read -r -s -n1 -p "[Espace] $*" _; echo; }
lance()  { $D "$@" 2>&1 | grep -E '"msg": "(TrackR|Liaison|.*expéditions restaurées)|fatal:|FAILED!' | sed -E 's/^ *"msg": "/    /; s/"$//'; }
sujets() { curl -s -m3 "$MAIL" | python3 -c 'import sys,json; print("\n".join(m["Subject"] for m in json.load(sys.stdin)["messages"]))' 2>/dev/null; }

echo "Préparation..."
$D demo-couper-liaison.yml -e retablir=oui >/dev/null 2>&1
curl -s -X DELETE "$MAIL" >/dev/null
info "Liaison en service, boîte mail vidée."
espace "démo 1"

titre "Démo 1 : arrêt brutal de TrackR"
lance demo-panne-trackr.yml
espace "démo 2"

titre "Démo 2 : coupure de la liaison Lille - Dunkerque"
lance demo-couper-liaison.yml
info "Attente de l'alerte..."
for i in $(seq 1 30); do
  if sujets | grep -q 'FIRING.*tunnel'; then info "Alerte reçue : $(sujets | grep -m1 'FIRING.*tunnel')"; break; fi
  sleep 6
done
espace "rétablir la liaison, puis démo 3"
lance demo-couper-liaison.yml -e retablir=oui

titre "Démo 3 : perte de la base TrackR"
$D demo-sinistre-trackr.yml >/dev/null 2>&1 && info "Expéditions supprimées."
espace "restaurer la base"
lance restaurer-trackr.yml -e cible=trackr -e confirmer=oui

echo; echo "Terminé."
