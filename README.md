# loginord-infra

Le dépôt Ansible de LogiNord. Il part de **LogiNord_base** (MC1 à MC5 : routeurs, tunnel
WireGuard, OSPF, socle Linux et Windows, Active Directory sur deux sites) et construit
**par-dessus** ce que demande l'énoncé : comptes AD sur les Debian, annuaire des
prestataires, TrackR en service sur web01 avec sa base sur db01, sauvegardes, gestion
du personnel, mises à jour et supervision.

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Schéma, machines, choix et leur justification |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Que faire quand ça casse, gérer le personnel, ajouter un site |
| [docs/DEMO.md](docs/DEMO.md) | Les démonstrations de la soutenance, pas à pas |
| [docs/README-base-loginord.md](docs/README-base-loginord.md) | Le README d'origine de la base du cours |

## Ce que fait le dépôt

| Rôle | Machines | Ce qu'il fait | Cours |
|---|---|---|---|
| `baseline`, `ssh_hardening` | toutes | Nom, heure, compte admin, SSH par clé (+ groupe AD au MC6) | MC1, MC3 |
| `network`, `router`, `wireguard`, `frr` | routeurs, Linux | IP fixes, pare-feu, tunnel chiffré, OSPF | MC2 |
| `win_network`, `ad_*` | dc01, dc02 | Forêt `loginord.internal`, DNS, sites, DHCP, AGDLP, LDAPS | MC4, MC5 |
| `pki` | poste Ansible | Autorité de certification interne (LDAPS d'ldap01, HTTPS de TrackR) | MC7 |
| `socle_linux` | Linux | Correctifs de sécurité quotidiens, journaux vers mon01, agent de supervision, audit | MC14, MC15 |
| `ad_client` | serveurs Linux | `realm join`, SSSD, sudo pour `GG_Admins_Linux` uniquement | MC6 |
| `openldap` | ldap01 | Annuaire des prestataires, StartTLS/LDAPS obligatoires, verrouillage en fin de mission | MC7 |
| `postgresql` | db01 | Base de TrackR, joignable par web01 seulement | MC11 |
| `trackr` | web01 | TrackR du cours en service durci, connexion AD en LDAPS, nginx en HTTPS | MC11 |
| `sauvegarde`, `backup_server` | serveurs Linux, bkp01 | Base sauvegardée toutes les heures, copie chiffrée à Lille | MC11 |
| `personnel` | dc01, ldap01, Linux | Arrivées, mobilités, départs depuis `data/personnel.yml` | MC13 |
| `monitoring`, `windows_exporter` | mon01, DC | Prometheus, alertes, Grafana, journaux centralisés 3 mois | MC15 |
| `vpn_admins` | rtr-a | VPN des informaticiens pour intervenir de chez eux | MC2, MC3 |

| Playbook | Usage |
|---|---|
| `site.yml` | Tout construire (relançable : `changed=0` au second passage) |
| `personnel.yml` | Appliquer le fichier du personnel (MC13) |
| `campagne-mises-a-jour.yml` | La campagne du dimanche, par vagues (MC14) |
| `rapport-assureur.yml` | Le rapport daté pour l'assureur (MC14) |
| `restaurer-trackr.yml` | Prouver la sauvegarde (base de test) ou restaurer la production (MC11) |
| `verifier.yml` | Tous les contrôles d'un coup |
| `demo-*.yml` | Scénarios de démonstration ([docs/DEMO.md](docs/DEMO.md)) |

---

## 1. Prérequis

Comme dans la base : un poste Linux, macOS ou WSL avec

```bash
python3 -m pip install ansible-core pywinrm cryptography
ansible-galaxy collection install -r requirements.yml
```

et les VM créées à la main (Debian 13 avec l'utilisateur `debian` et votre clé SSH,
Windows Server 2025 Core avec WinRM actif), une carte NAT + les cartes internes.

| Machine | Site | IP LAN | RAM conseillée |
|---|---|---|---|
| rtr-a | Lille | 10.1.10.1 (WAN 192.0.2.1) | 512 Mo |
| dc01 | Lille | 10.1.10.10 | 2 Go |
| **bkp01** | Lille | 10.1.10.20 | 512 Mo |
| rtr-b | Dunkerque | 10.1.20.1 (WAN 192.0.2.2) | 512 Mo |
| dc02 | Dunkerque | 10.1.20.10 | 2 Go |
| web01 | Dunkerque | 10.1.20.20 | 1 Go |
| db01 | Dunkerque | 10.1.20.21 | 1 Go |
| mon01 | Dunkerque | 10.1.20.30 | 1,5 Go |
| ldap01 | Dunkerque | 10.1.20.31 | 512 Mo |

bkp01 est un ajout : la copie des sauvegardes hors de la salle serveur de Dunkerque.

## 2. Adapter le dépôt à VOS machines

| Fichier | Quoi changer |
|---|---|
| `inventory/hosts.yml` → `ansible_host` | L'IP de l'interface NAT de chaque VM (elle a été déplacée ici depuis `host_vars`) |
| `group_vars/routers.yml`, `host_vars/rtr-*.yml` | Les noms d'interfaces des routeurs |
| `host_vars/<serveur>.yml` | Le nom de la carte LAN (`ens19` par défaut) |
| `group_vars/windows.yml` → `win_lan_alias` | Le nom de la carte LAN sous Windows |

## 3. Le vault

```bash
cp vault/secrets.example.yml vault/secrets.yml
nano vault/secrets.yml                      # mots de passe, clés WireGuard (privées ET publiques)
ansible-vault encrypt vault/secrets.yml
echo 'votre-mot-de-passe-de-vault' > ~/.vault_pass && chmod 600 ~/.vault_pass
```

Les clés WireGuard : `wg genkey | tee rtr-a.key | wg pubkey > rtr-a.pub` (et de même pour
rtr-b). Les privées **et** les publiques vont dans le vault ; supprimez ensuite les fichiers.

## 4. Déployer

```bash
export ANSIBLE_VAULT_PASSWORD_FILE=~/.vault_pass
ansible-playbook site.yml --tags socle,routeurs     # fondations et réseau
ansible-playbook site.yml --tags dc01,dc02          # l'Active Directory
ansible-playbook site.yml                           # tout le reste (et tout d'un coup)
ansible-playbook site.yml                           # le test qui compte : changed=0
```

## 5. Vérifier

```bash
ansible-playbook verifier.yml
```

| Brique | Commande manuelle | Attendu |
|---|---|---|
| Tunnel | `sudo wg show` sur rtr-a | `latest handshake` de moins de 2 minutes |
| OSPF | `sudo vtysh -c "show ip route ospf"` sur rtr-a | `O>* 10.1.20.0/24 via 10.255.0.2` |
| AD sur Linux (MC6) | `id chloe.leroy` sur web01 | ses groupes AD |
| sudo (MC6) | `ssh adm-chloe.leroy@web01` puis `sudo -i` | accepté ; refusé pour `david.lambert` |
| Prestataires (MC7) | `ldapsearch -x -ZZ -H ldap://ldap01 -D uid=jean.dupont,ou=prestataires,dc=loginord,dc=internal -W -b ou=prestataires,dc=loginord,dc=internal` | la fiche de Jean Dupont |
| TrackR (MC11) | https://trackr.loginord.internal | la liste des expéditions, connexion avec un compte Windows |
| Service (MC11) | `sudo kill -9 $(systemctl show -p MainPID --value trackr)` | TrackR revient seul en 5 s |
| Sauvegarde (MC11) | `ansible-playbook restaurer-trackr.yml` | « N expéditions restaurées dans trackr_test » |
| Supervision (MC15) | http://10.1.20.30:3000 | le tableau de bord « LogiNord - vue client » |
| Journaux (MC15) | `ls /var/log/central/` sur mon01 | un dossier par machine |

## 6. Le labo (partie Linux, sur un PC)

Le dossier [lab/](lab/) recrée la partie Linux dans VirtualBox (deux LAN, un WAN, les
routeurs, le tunnel, web01, db01, mon01, ldap01, bkp01) pour tester sans l'école :

```bash
cd lab
vagrant up
```

Sans Windows, la jonction au domaine (MC6) est sautée et TrackR utilise des comptes
locaux. TrackR : https://localhost:8443, supervision : http://localhost:3000,
alertes : http://localhost:8025.

## À ne jamais committer

- `vault/secrets.yml` **non chiffré**, `~/.vault_pass`
- les clés privées WireGuard (`*.key`), le dossier `lab/.lab/`
