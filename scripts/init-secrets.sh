#!/bin/bash
# Génère, une seule fois, tous les mots de passe de l'infrastructure dans un
# coffre chiffré (Ansible Vault). Rien n'est écrit en clair dans le dépôt.
#   - ansible/.vault_pass   : la clé du coffre (à ranger dans le gestionnaire
#                             de mots de passe de l'entreprise, PAS dans git)
#   - .../group_vars/all/vault.yml : le coffre chiffré
set -euo pipefail
cd "$(dirname "$0")/../ansible"
VAULT=inventories/lab/group_vars/all/vault.yml
umask 077
[ -s .vault_pass ] || openssl rand -base64 32 > .vault_pass
if [ -f "$VAULT" ]; then echo "Coffre déjà présent : $VAULT"; exit 0; fi

pw() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-20}"; }
TMP=$(mktemp)
cat > "$TMP" <<VAULT
# Coffre généré le $(date -Iseconds). Consulter : ansible-vault view $VAULT
vault_windows_bootstrap_password: "vagrant"          # compte livré avec l'image Vagrant
vault_ad_admin_password: "Adm-$(pw 16)-9a"
vault_ad_dsrm_password: "Dsrm-$(pw 16)-7b"
vault_windows_breakglass_password: "Secours-$(pw 12)-3c"
vault_linux_breakglass_password: "Secours-$(pw 12)-4d"
vault_users_initial_password: "Bienvenue-$(pw 6)-2026"   # mot de passe de démo des salariés
vault_prestataires_password: "Presta-$(pw 6)-2026"        # mot de passe de démo des prestataires
vault_ldap_admin_password: "$(pw 24)"
vault_svc_backup_password: "Svc-$(pw 16)-5e"
vault_trackr_secret_key: "$(pw 48)"
vault_trackr_replication_password: "$(pw 24)"
vault_borg_passphrase: "$(pw 32)"
vault_grafana_admin_password: "$(pw 16)"
VAULT
ansible-vault encrypt --output "$VAULT" "$TMP" >/dev/null
rm -f "$TMP"
echo "Coffre créé : $VAULT"
