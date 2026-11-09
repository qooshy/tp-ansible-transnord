#!/bin/bash
# Lance un playbook dans le labo, en laissant une trace : qui, quoi, quand, résultat.
#   bash /srv/loginord/lab/deploy.sh site.yml [options ansible-playbook]
# Sans Active Directory dans le labo, la jonction au domaine (MC6) est sautée.
set -uo pipefail
cd /srv/loginord
export ANSIBLE_VAULT_PASSWORD_FILE=/srv/loginord/lab/.lab/vault_pass
export ANSIBLE_CONFIG=/srv/loginord/ansible.cfg
export ANSIBLE_HOST_KEY_CHECKING=False      # labo : les VM sont recréées souvent
[ -f vault/secrets.yml ] || bash lab/init-secrets.sh
PLAYBOOK="${1:-site.yml}"; shift || true
logger -t ansible-run "DEBUT utilisateur=$USER playbook=$PLAYBOOK $*"
ansible-playbook -i lab/inventory.yml -e @lab/lab-vars.yml --skip-tags ad_linux "$PLAYBOOK" "$@"; RC=$?
logger -t ansible-run "FIN utilisateur=$USER playbook=$PLAYBOOK code=$RC"
exit $RC
