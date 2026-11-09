# Architecture de LogiNord

## Vue d'ensemble

```
            SITE A · LILLE (siège)                              SITE B · DUNKERQUE (quai, salle serveur)
         LAN 10.1.10.0/24                                       LAN 10.1.20.0/24

   ┌────────┐   ┌────────┐                               ┌────────┐ ┌────────┐ ┌────────┐
   │  dc01  │   │ bkp01  │                               │  dc02  │ │ web01  │ │  db01  │
   │ AD DNS │   │sauve-  │                               │ AD DNS │ │ TrackR │ │Postgre-│
   │ DHCP   │   │gardes  │                               │        │ │ nginx  │ │  SQL   │
   └───┬────┘   └───┬────┘                               └───┬────┘ └───┬────┘ └───┬────┘
       │            │                                        │          │          │
   ────┴────────────┴─────┐                         ┌────────┴──────────┴──────────┴────
                          │                         │        ┌────────┐ ┌────────┐
                     ┌────┴────┐   WAN 192.0.2.0/24 ┌┴───────┐│ mon01  │ │ ldap01 │
  informaticiens ───►│  rtr-a  ├────────────────────┤ rtr-b  ││supervi-│ │presta- │
  (VPN wg1)          │         │  tunnel WireGuard  │        ││sion    │ │taires  │
                     └─────────┘  wg0 + OSPF        └────────┘└────────┘ └────────┘
```

La base du cours (MC1 à MC5) : les deux routeurs, le tunnel chiffré avec OSPF, le
domaine `loginord.internal` avec un DC par site. Tout le reste est construit par-dessus.

## Les machines

| Machine | Site | Système | Rôle | Cours |
|---|---|---|---|---|
| rtr-a, rtr-b | Lille, Dunkerque | Debian 13 | Routeur, pare-feu, tunnel WireGuard, OSPF ; rtr-a porte aussi le VPN des informaticiens | MC2 |
| dc01 | Lille | Windows Server 2025 Core | AD DS, DNS, DHCP de Lille, LDAPS | MC4 |
| dc02 | Dunkerque | Windows Server 2025 Core | AD DS, DNS de Dunkerque, LDAPS | MC5 |
| web01 | Dunkerque | Debian 13 | TrackR (service durci) derrière nginx en HTTPS | MC11 |
| db01 | Dunkerque | Debian 13 | PostgreSQL de TrackR, sauvegarde toutes les heures | MC11 |
| ldap01 | Dunkerque | Debian 13 | OpenLDAP des prestataires | MC7 |
| mon01 | Dunkerque | Debian 13 | Prometheus, Alertmanager, Grafana, journaux centraux | MC15 |
| bkp01 | Lille | Debian 13 | Copie chiffrée des sauvegardes, hors de Dunkerque | MC11 (bonus) |

## Les besoins du client et ce qui y répond

| Besoin | Réponse | Où |
|---|---|---|
| TrackR ne doit plus bloquer les camions | Service systemd qui redémarre seul (même après `kill -9`), durci, mémoire bornée ; supervisé comme un utilisateur toutes les 15 s | `roles/trackr`, `roles/monitoring` |
| Dunkerque travaille si la liaison est coupée | TrackR, sa base et un DC sont à Dunkerque ; SSSD garde les identités en cache | base (MC5), `roles/ad_client` |
| Ne jamais ressaisir, tout retrouver | Base sauvegardée toutes les heures, gardée 7 jours sur place et copiée chiffrée à Lille ; restauration testée | `roles/sauvegarde`, `restaurer-trackr.yml` |
| Salaires : RH et direction uniquement | Groupes AGDLP (`DL_Partage_RH_RW` = `GG_RH`) prêts pour le partage de fs01 (MC10) | base (MC4) |
| Un seul identifiant, changements de poste | `data/personnel.yml` tenu par les RH : arrivée, mobilité (`groups: set`), départ | `roles/personnel` |
| Prestataires : le temps de la mission | Annuaire séparé (OpenLDAP), accès à web01 seulement, verrouillé à la date de fin | `roles/openldap` |
| Prévenu avant les clients | Alertes en français par e-mail (et Discord) : TrackR, base, tunnel, DC, disque, sauvegarde | `roles/monitoring` |
| Preuve pour l'assureur | Correctifs de sécurité chaque nuit, campagne du dimanche par vagues, rapport HTML daté | `socle_linux`, `campagne-mises-a-jour.yml`, `rapport-assureur.yml` |
| Savoir qui a fait quoi | Journaux de toutes les Debian sur mon01 (3 mois), audit des commandes root, journal de TrackR | `socle_linux`, `roles/monitoring` |
| Intervenir de chez soi | VPN WireGuard par informaticien sur rtr-a, puis compte `adm-` | `roles/vpn_admins` |
| Reconstruire sans l'ancien informaticien | Ce dépôt : `site.yml` reconstruit tout, idempotent | tout le dépôt |
| Un nouveau site sans y passer deux ans | Un routeur, un DC, un groupe d'inventaire, un réseau OSPF de plus | [RUNBOOK](RUNBOOK.md#ajouter-un-site) |

## Choix techniques

| Sujet | Choix | Pourquoi |
|---|---|---|
| Supervision | **Prometheus + Grafana** plutôt que Zabbix | MON01 a peu de RAM : pas de base de données, agents légers (`node_exporter`, `windows_exporter`) |
| Alertes | Alertmanager → e-mail, et webhook Discord si renseigné | Le canal est testé de bout en bout (`demo-disque-plein.yml`) |
| Journaux | rsyslog → mon01, file d'attente sur disque | Rien de perdu si le tunnel tombe ; journald persistant en local |
| Sauvegarde | `pg_dump` horaire + **BorgBackup** vers bkp01, en ajout seul | Un pirate sur db01 ne peut pas effacer les copies de Lille |
| Prestataires | OpenLDAP + SSSD (deuxième domaine) sur web01 | Ils n'ont jamais de compte dans l'AD ; ils ne voient que web01 |
| TrackR | Celui du cours, **non modifié** ; nginx devant | HTTPS, en-têtes de sécurité, TrackR n'écoute qu'en local |
| Certificats | Autorité interne (sur le poste Ansible) pour ldap01 et web01 ; LDAPS des DC par `ad_ldaps` | Tout est chiffré sans acheter de certificats |
| Accès distant | VPN dédié (`wg1`) séparé du tunnel inter-sites (`wg0`) | Un accès par personne, retiré automatiquement au départ |

## Flux autorisés par les routeurs

| De | Vers | Port | Usage |
|---|---|---|---|
| LAN Lille ↔ LAN Dunkerque | | tout, via le tunnel | AD, réplication, sauvegardes |
| mon01 | routeurs | 9100 | Mesures |
| Internet (carte NAT) | rtr-a | 51821/udp | VPN des informaticiens |
| VPN informaticiens | LAN | 22, 5985, 3000 | SSH, WinRM, Grafana, rien d'autre |

## Limites assumées

- **fs01** (partages de fichiers, quotas, MC10), les **GPO** (MC8), le **RAID/LVM** de db01
  (MC9) et le **pipeline GitLab** (MC12) ne sont pas dans ce périmètre ; les groupes AGDLP
  et `personnel.yml` sont prêts à les accueillir.
- TrackR du cours n'authentifie que l'AD (ou des comptes locaux) : les prestataires
  accèdent à web01 (SSH), pas encore à l'interface TrackR.
- Le labo sur PC n'a pas les DC Windows : la jonction AD et la connexion AD de TrackR
  se testent sur le matériel de l'école.
