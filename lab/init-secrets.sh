#!/bin/bash
# Labo : remplit vault/secrets.yml avec des valeurs aléatoires (clés WireGuard comprises)
# et le chiffre. À l'école, on le remplit soi-même à partir de vault/secrets.example.yml.
set -euo pipefail
cd /srv/loginord
mkdir -p lab/.lab && umask 077
[ -s lab/.lab/vault_pass ] || openssl rand -hex 24 > lab/.lab/vault_pass
[ -f vault/secrets.yml ] && { echo "vault/secrets.yml existe déjà"; exit 0; }
pw() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-20}"; }
A=$(wg genkey); B=$(wg genkey)
T=$(mktemp)
cat > "$T" <<V
vault_win_password: "Labo-$(pw 12)-1a"
vault_admin_password: "Labo-$(pw 12)-2b"
vault_dsrm_password: "Labo-$(pw 12)-3c"
vault_ad_user_password: "Labo-$(pw 12)-4d"
vault_wg_rtr_a: "$A"
vault_wg_rtr_b: "$B"
vault_wg_pub_rtr_a: "$(echo "$A" | wg pubkey)"
vault_wg_pub_rtr_b: "$(echo "$B" | wg pubkey)"
vault_ad_join_password: "Labo-$(pw 12)-5e"
vault_ldap_admin_password: "$(pw 24)"
vault_ldap_sssd_password: "$(pw 24)"
vault_presta_password: "Presta-$(pw 8)-2026"
vault_trackr_db_password: "$(pw 24)"
vault_trackr_secret: "$(openssl rand -hex 32)"
vault_trackr_local_users: "admin:Admin-$(pw 8),david.lambert:Quai-$(pw 8)"
vault_borg_passphrase: "$(pw 32)"
vault_grafana_admin_password: "$(pw 16)"
vault_discord_webhook: ""
V
ansible-vault encrypt --vault-password-file lab/.lab/vault_pass --output vault/secrets.yml "$T" >/dev/null
rm -f "$T"
echo "vault/secrets.yml créé (labo). Voir : ansible-vault view vault/secrets.yml --vault-password-file lab/.lab/vault_pass"
