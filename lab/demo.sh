#!/bin/bash
# Les 3 démos de la soutenance, enchaînées : ESPACE pour passer à la suite.
# Depuis le PC (PowerShell, dossier lab) :
#   vagrant ssh ctl -- -t "bash /srv/loginord/lab/demo.sh"
set -uo pipefail
cd /srv/loginord
D="bash lab/deploy.sh"
MAIL="http://10.0.2.2:8025/api/v1/messages"        # boîte mail des alertes (via le PC)
B=$'\e[1m'; V=$'\e[32m'; O=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'

titre()  { echo; echo "${B}${O}==================== $* ====================${N}"; }
ok()     { echo "${V}  ✔ $*${N}"; }
info()   { echo "    $*"; }
espace() { echo; read -r -s -n1 -p "${B}  [ESPACE] $*${N}" _; echo; }
lance()  { $D "$@" 2>&1 | grep -E '"msg": "(TrackR|Liaison|.*expéditions restaurées)|fatal:|FAILED!' | sed -E 's/^ *"msg": "//; s/"$//'; }
sujets() { curl -s -m3 "$MAIL" | python3 -c 'import sys,json; print("\n".join(m["Subject"] for m in json.load(sys.stdin)["messages"]))' 2>/dev/null; }

# ------------------------------------------------------------ préparation
echo "${B}Préparation...${N}"
$D demo-couper-liaison.yml -e retablir=oui >/dev/null 2>&1
curl -s -X DELETE "$MAIL" >/dev/null
ok "Liaison en service, boîte mail des alertes vidée"
espace "Démo 1 : TrackR plante"

# ------------------------------------------------------------ démo 1
titre "DÉMO 1 - TrackR plante, les camions ne le voient pas"
info "On tue TrackR de la façon la plus brutale qui existe (kill -9)..."
lance demo-panne-trackr.yml
ok "Rafraîchissez TrackR : tout est là."
espace "Démo 2 : la liaison Lille - Dunkerque tombe"

# ------------------------------------------------------------ démo 2
titre "DÉMO 2 - La liaison Lille - Dunkerque tombe"
lance demo-couper-liaison.yml
info "Créez une expédition dans TrackR : Dunkerque continue de travailler."
info "Attente de l'alerte (environ 1 min 30) ; le tableau de bord passe au rouge..."
for i in $(seq 1 30); do
  if sujets | grep -q 'FIRING.*tunnel'; then ok "E-mail reçu : $(sujets | grep -m1 'FIRING.*tunnel')"; break; fi
  sleep 6
done
espace "Rétablir la liaison et passer à la démo 3"
lance demo-couper-liaison.yml -e retablir=oui

# ------------------------------------------------------------ démo 3
titre "DÉMO 3 - Un sinistre efface tout, on récupère tout"
$D demo-sinistre-trackr.yml >/dev/null 2>&1 && ok "Toutes les expéditions sont effacées. Rafraîchissez TrackR : la liste est vide."
espace "Restaurer la base depuis la sauvegarde"
lance restaurer-trackr.yml -e cible=trackr -e confirmer=oui
ok "Rafraîchissez TrackR : tout est revenu."

echo; echo "${B}${V}Fin des démonstrations.${N}"
