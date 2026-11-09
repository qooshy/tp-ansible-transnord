# Procédures d'exploitation (runbook)

Toutes les commandes se lancent depuis le poste Ansible, à la racine du dépôt, avec
`export ANSIBLE_VAULT_PASSWORD_FILE=~/.vault_pass` (dans le labo : `bash lab/deploy.sh <playbook>`).

[Reconstruire](#reconstruire-toute-linfrastructure) · [Personnel](#gestion-du-personnel-mc13) ·
[TrackR](#trackr) · [Restaurer](#restaurer-trackr) · [Liaison](#la-liaison-lille--dunkerque-est-coupée) ·
[DC](#un-contrôleur-de-domaine-est-en-panne) · [Alertes](#que-faire-pour-chaque-alerte) ·
[Qui a fait quoi](#qui-a-fait-quoi-quand) · [Mises à jour](#mises-à-jour-et-assureur-mc14) ·
[Accès distant](#intervenir-de-chez-soi) · [Ajouter un site](#ajouter-un-site)

---

## Reconstruire toute l'infrastructure

Un nouvel informaticien, sans appeler l'ancien :

1. Créer les VM comme dans le [README](../README.md#1-prérequis) (Debian 13 avec
   l'utilisateur `debian` et sa clé, Windows Server 2025 Core avec WinRM).
2. Récupérer le mot de passe du vault dans le gestionnaire de mots de passe de l'entreprise.
3. Adapter `inventory/hosts.yml` (les IP NAT).
4. `ansible-playbook site.yml` puis `ansible-playbook verifier.yml`.
5. Restaurer les données de TrackR depuis Lille : `ansible-playbook restaurer-trackr.yml -e cible=trackr -e confirmer=oui -e source=lille`.

L'annuaire (OU, groupes, comptes) est recréé à l'identique depuis `data/personnel.yml`.

---

## Gestion du personnel (MC13)

`data/personnel.yml` est la **seule** source de vérité. Les RH le modifient (merge request),
puis : `ansible-playbook personnel.yml`.

| Situation | Dans `personnel.yml` | Effet |
|---|---|---|
| Arrivée | une ligne avec `service` et `site` | compte dans l'OU du site, groupes du service, mot de passe à changer à la 1re connexion |
| Informaticien | `service: it` | en plus un compte `adm-<id>` dans `GG_Admins_Linux` (sudo) et un accès VPN |
| Mobilité | changer `service` ou `site` | changement d'OU, groupes **remplacés** (jamais ajoutés) |
| Départ | `depart: "AAAA-MM-JJTHH:MM"` | à l'heure dite : désactivé, rangé dans `Departs`, retiré des groupes, sessions Linux fermées, cache SSSD vidé, VPN retiré. **Jamais supprimé.** |
| Prestataire | `type: prestataire`, `societe`, `expiration` | compte dans OpenLDAP, accès à web01 seulement ; verrouillé la nuit suivant l'expiration, même sans Ansible |

Les règles (service → groupes, site → OU) sont dans `data/regles.yml`. Planifier
`personnel.yml` chaque soir suffit à couper les départs « le soir même ».

---

## TrackR

| Symptôme | Action |
|---|---|
| TrackR ne répond plus | `systemctl status trackr nginx` sur web01, puis `journalctl -u trackr` (toujours en premier) |
| Il a planté | Rien : systemd le relance en 5 s (`Restart=on-failure`), testé avec `kill -9` |
| Il redémarre en boucle puis s'arrête | `systemctl reset-failed trackr`, puis lire `journalctl -u trackr` (souvent la base) |
| « l'annuaire ne répond pas » | DNS de web01 vers les DC, port 636, certificats : relancer `site.yml --tags trackr` (récupère les certificats des DC) |
| « votre compte n'a pas accès » | L'utilisateur n'est pas dans un groupe membre de `DL_TrackR_Acces` |
| Base injoignable (alerte `BaseTrackRInjoignable`) | `systemctl status postgresql` sur db01 |

---

## Restaurer TrackR

```bash
ansible-playbook restaurer-trackr.yml                                   # preuve : base de TEST
ansible-playbook restaurer-trackr.yml -e cible=trackr -e confirmer=oui  # production
ansible-playbook restaurer-trackr.yml -e cible=trackr -e confirmer=oui -e source=lille
```

Les exports sont faits **toutes les heures** sur db01 (gardés 7 jours dans `/var/backups/pg`)
et copiés chiffrés sur bkp01 à Lille. Prochaine sauvegarde : `systemctl list-timers sauvegarde.timer`.

---

## La liaison Lille ↔ Dunkerque est coupée

Alerte `TunnelInterSitesCoupe`. Chaque site continue seul :
Dunkerque a TrackR, sa base et DC02 ; Lille a DC01 ; les Debian gardent les identités
en cache (SSSD). Les journaux attendent dans une file sur disque et arrivent au retour.

Diagnostic : `sudo wg show` (handshake ?) puis `sudo vtysh -c "show ip ospf neighbor"` sur
les routeurs ; `ping 192.0.2.2` depuis rtr-a (le WAN). Voir aussi `docs/TUTO_FRR_OSPF.md`.

---

## Un contrôleur de domaine est en panne

Les connexions passent par l'autre DC (TrackR et SSSD essaient d'abord celui du site,
puis l'autre). Ne jamais redémarrer les deux en même temps. Pour reconstruire :
réinstaller Windows Server 2025 avec la même IP, puis `ansible-playbook site.yml --tags dc02`
(ou `dc01` ; nettoyer d'abord l'ancien objet DC dans l'AD).

---

## Que faire pour chaque alerte

Les alertes arrivent par e-mail (labo : http://localhost:8025) et sur Discord si un webhook
est renseigné ; le tableau de bord est sur http://10.1.20.30:3000.

| Alerte | Action |
|---|---|
| TrackRIndisponible | [TrackR](#trackr) |
| BaseTrackRInjoignable | `systemctl status postgresql` sur db01 |
| TunnelInterSitesCoupe | [Liaison](#la-liaison-lille--dunkerque-est-coupée) |
| ServeurInjoignable | Console de l'hyperviseur, redémarrer la VM, `verifier.yml` |
| ControleurDeDomaineEnPanne | [DC](#un-contrôleur-de-domaine-est-en-panne) |
| AnnuairePrestatairesEnPanne | `systemctl status slapd` sur ldap01 |
| DisqueBientotPlein / DisqueSeRemplitVite | `du -xh / \| sort -h \| tail` ; agrandir le disque |
| SauvegardeBaseTropAncienne / SauvegardeTropAncienne / SauvegardeEnEchec | `journalctl -u sauvegarde` sur le serveur, puis `systemctl start sauvegarde` |
| MisesAJourDeSecuriteEnAttente | `/var/log/unattended-upgrades/` sur le serveur |
| RedemarrageEnAttente | Fait par la campagne du dimanche |
| CertificatBientotExpire | `ansible-playbook site.yml --tags pki,ldap,trackr` |

---

## Qui a fait quoi, quand

| Question | Où |
|---|---|
| Qui s'est connecté à un serveur, d'où | `mon01:/var/log/central/<serveur>/sshd.log` |
| Quelles commandes root ont été lancées, par qui | `mon01:/var/log/central/<serveur>/audisp-syslog.log` (clé `commande_admin`) |
| Connexions à TrackR, réussies ou refusées | `journalctl -u trackr` sur web01, et `mon01:/var/log/central/web01/` |
| Qui a créé une expédition | colonne `cree_par` dans TrackR |
| Qui a demandé une arrivée ou un départ | l'historique git de `data/personnel.yml` (merge requests) |
| Connexions aux DC | `Get-WinEvent -LogName Security` (4624 / 4625) |

Les journaux sont conservés **3 mois** sur mon01.

---

## Mises à jour et assureur (MC14)

- Chaque jour : correctifs de **sécurité** seulement, automatiquement, sans redémarrage.
- Le dimanche : `ansible-playbook campagne-mises-a-jour.yml` : machine test (mon01),
  Dunkerque, DC02, Lille, DC01, une machine à la fois ; la moindre erreur arrête tout.
- Le rapport : `ansible-playbook rapport-assureur.yml` → `reports/rapport-assureur-<date>.html`.

---

## Intervenir de chez soi

Chaque informaticien en poste a un fichier `~/.loginord-vpn/<id>.conf` (sur le poste
Ansible, à lui transmettre) à importer dans l'application WireGuard. Une fois connecté :
`ssh adm-<id>@10.1.20.20` avec son mot de passe AD. Le VPN ne laisse passer que SSH,
WinRM et Grafana. Un départ retire son accès au passage suivant de `site.yml`.

---

## Ajouter un site

Exemple : un entrepôt à Calais, LAN 10.1.30.0/24.

1. Créer `rtr-c` (Debian) et `dc03` (Windows) ; un groupe `site_c` dans `inventory/hosts.yml`
   et `group_vars/site_c.yml` (`site_code`, `site_name`, `site_subnet`, `site_gateway`).
2. `host_vars/rtr-c.yml` : interfaces, tunnel (un peer de plus côté rtr-a/rtr-b), réseaux OSPF.
3. `group_vars/dcs.yml` : le site et son sous-réseau dans `ad_sites`, l'OU dans `ad_site_ous`.
4. `ansible-playbook site.yml`.

OSPF annonce le nouveau réseau tout seul ; la supervision et les sauvegardes suivent
l'inventaire. Compter une demi-journée.
