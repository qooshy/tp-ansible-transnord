#!/bin/bash
# Prépare ops01 comme poste de contrôle Ansible (exécuté en root par Vagrant,
# ou à la main sur une Debian 12 neuve : bash scripts/bootstrap-control.sh).
set -euo pipefail
REPO=${REPO:-/srv/infra}
OPERATOR=${OPERATOR:-vagrant}

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip python3-cryptography git openssl sshpass smbclient ldap-utils jq >/dev/null

[ -x /opt/ansible/bin/ansible-playbook ] || python3 -m venv /opt/ansible
/opt/ansible/bin/pip install -q --upgrade pip
/opt/ansible/bin/pip install -q -r "$REPO/ansible/requirements.txt"
/opt/ansible/bin/ansible-galaxy collection install -r "$REPO/ansible/requirements.yml" -p /opt/ansible/collections >/dev/null
for b in /opt/ansible/bin/ansible*; do ln -sf "$b" /usr/local/bin/; done

# Clé SSH du labo pour l'opérateur (Vagrant la génère sur le PC hôte)
if [ -f "$REPO/.lab/id_ed25519" ]; then
  install -d -m 700 -o "$OPERATOR" -g "$OPERATOR" "/home/$OPERATOR/.ssh"
  install -m 600 -o "$OPERATOR" -g "$OPERATOR" "$REPO/.lab/id_ed25519" "/home/$OPERATOR/.ssh/id_ed25519"
fi

# Dossier de l'autorité de certification interne
install -d -m 700 -o "$OPERATOR" -g "$OPERATOR" /var/lib/transnord-pki
echo "ops01 prêt : $(/opt/ansible/bin/ansible --version | head -1)"
