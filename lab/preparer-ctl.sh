#!/bin/bash
# Le poste Ansible du labo : Ansible, les collections du dépôt, la clé SSH du labo.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip git openssl wireguard-tools ldap-utils >/dev/null
[ -x /opt/ansible/bin/ansible-playbook ] || python3 -m venv /opt/ansible
/opt/ansible/bin/pip install -q --upgrade pip
/opt/ansible/bin/pip install -q 'ansible-core==2.18.6' 'pywinrm==0.5.0' 'cryptography' 'passlib'
/opt/ansible/bin/ansible-galaxy collection install -r /srv/loginord/requirements.yml -p /usr/share/ansible/collections >/dev/null
for b in /opt/ansible/bin/ansible*; do ln -sf "$b" /usr/local/bin/; done
install -d -m 700 -o vagrant -g vagrant /home/vagrant/.ssh
install -m 600 -o vagrant -g vagrant /srv/loginord/lab/.lab/id_ed25519 /home/vagrant/.ssh/id_ed25519
install -m 644 -o vagrant -g vagrant /srv/loginord/lab/.lab/id_ed25519.pub /home/vagrant/.ssh/id_ed25519.pub
echo "ctl prêt : $(/opt/ansible/bin/ansible --version | head -1)"
