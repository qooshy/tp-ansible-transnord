# Infrastructure TransNord — déployée et documentée par Ansible

Infrastructure complète d'une entreprise de transport de 120 salariés sur deux
sites (Lille : direction, RH, compta, informatique — Dunkerque : quai,
exploitation, salle serveur). **Tout est décrit dans ce dépôt** : un nouvel
informaticien reconstruit l'ensemble avec une seule commande, sans appeler
personne.

| Document | Pour qui | Contenu |
|---|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | tout le monde | schéma, machines, choix techniques et pourquoi |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | informaticiens | « quand ça casse, je fais quoi », gestion des personnes, ajout d'un site |
| [docs/DEMO.md](docs/DEMO.md) | soutenance | déroulé de la démonstration technique |

## Les besoins et ce qui y répond

| Besoin exprimé | Réponse | Où dans le dépôt |
|---|---|---|
| TrackR ne doit plus jamais bloquer les camions | 2 serveurs TrackR, base copiée en continu, adresse flottante qui bascule seule en quelques secondes ; le poste du quai garde les saisies si le serveur ne répond pas | `roles/trackr` |
| Dunkerque doit travailler même si la liaison est coupée | Serveurs à Dunkerque + un contrôleur de domaine par site (les connexions restent locales) | `roles/samba_dc`, `hosts.yml` |
| Ne jamais ressaisir, tout retrouver | Saisies jamais modifiées ni effacées ; sauvegarde chiffrée chaque nuit **à Lille** (hors site), restauration en une commande | `roles/backup_*`, `playbooks/ops/restaurer-trackr.yml` |
| Salaires : RH et direction uniquement | Partage Paie chiffré, invisible et interdit aux autres, chaque accès et chaque refus est journalisé | `roles/samba_dc/tasks/paie.yml` |
| Un seul identifiant par personne, changements de poste | Annuaire unique (Active Directory) alimenté par **le fichier des RH** `personnel.csv` : un changement de poste = un mot modifié | `inventories/lab/personnel.csv` |
| Prestataires : accès limité, le temps de la mission | Annuaire séparé (OpenLDAP), chiffré, ne voient que TrackR sans données personnelles, **verrouillés automatiquement** à la date de fin | `roles/openldap` |
| Être prévenu avant que les clients appellent | Supervision (Prometheus) + alertes e-mail en français + tableau de bord (Grafana) | `roles/monitoring` |
| L'assureur veut une preuve que tout est à jour | Mises à jour de sécurité automatiques chaque nuit, compteur « mises à jour en attente » sur le tableau de bord, historique conservé 1 an | `roles/common` |
| Savoir qui a fait quoi, quand | Journaux de tous les serveurs centralisés et conservés 1 an, audit des commandes administrateur, journal TrackR, trace de chaque exécution d'Ansible | `roles/common/tasks/audit.yml`, `scripts/deploy` |
| Intervenir de chez soi, la nuit, le week-end | VPN WireGuard (un accès par informaticien, retiré automatiquement à son départ) + bastion SSH avec l'identifiant unique | `roles/wireguard` |
| Reconstruire sans l'ancien informaticien | Ce dépôt : `vagrant up` (labo) ou `site.yml` (production) recrée tout | ce fichier |
| Ouvrir un site ne doit pas prendre 2 ans | Ajouter un site = quelques lignes dans l'inventaire, le reste suit (DNS, DC, supervision) | [RUNBOOK §Ajouter un site](docs/RUNBOOK.md#ajouter-un-site) |
| Budget serré | 100 % logiciels libres et gratuits, y compris l'Active Directory (Samba AD) : 0 € de licence | [ARCHITECTURE §Coûts](docs/ARCHITECTURE.md#coûts) |

## Démarrer le laboratoire

Prérequis sur le PC : VirtualBox 7, Vagrant 2.4, OpenSSH (inclus dans Windows),
**environ 4 Go de mémoire libre** et 15 Go de disque.

```bash
vagrant up
```

C'est tout : Vagrant crée les 7 machines, puis `ops01` installe Ansible et
déploie l'ensemble (environ 30 minutes la première fois).

Ensuite, depuis le PC :

| Service | Adresse |
|---|---|
| TrackR | https://192.168.56.20 (importer d'abord `transnord-ca.crt`, voir [DEMO](docs/DEMO.md)) |
| Tableau de bord | http://192.168.56.10:3000 |
| Boîte mail des alertes | http://192.168.56.10:8025 |

Les mots de passe sont générés au premier déploiement dans un coffre chiffré :

```bash
vagrant ssh ops01 -c "cd /srv/infra/ansible && ansible-vault view inventories/lab/group_vars/all/vault.yml"
```

## Commandes du quotidien (sur ops01, dans `/srv/infra/ansible`)

```bash
bash ../scripts/deploy playbooks/site.yml                 # tout remettre en conformité
bash ../scripts/deploy playbooks/site.yml --tags identites   # appliquer le fichier RH
bash ../scripts/deploy playbooks/verifier.yml             # contrôles de bon fonctionnement
bash ../scripts/deploy playbooks/ops/restaurer-trackr.yml # restaurer TrackR
```

`scripts/deploy` enregistre qui a lancé quoi et quand dans le journal central.

## Arborescence

```
Vagrantfile                  machines du labo (lues dans l'inventaire)
scripts/                     bootstrap d'ops01, secrets, lancement tracé
ansible/
  ansible.cfg
  requirements.{txt,yml}     versions figées d'Ansible et des collections
  inventories/lab/
    hosts.yml                machines rangées par site et par rôle
    personnel.csv            LE fichier des RH (salariés et prestataires)
    group_vars/              paramètres (all/main.yml en premier)
  playbooks/
    site.yml                 déploiement complet
    verifier.yml             contrôles
    ops/                     procédures d'exploitation (restauration, bascule…)
    demo/                    scénarios de démonstration (coupure, sinistre…)
  roles/                     une brique par fonction
docs/                        architecture, procédures, démonstration
```
