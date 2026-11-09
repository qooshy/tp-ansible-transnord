# Procédures d'exploitation (runbook)

Toutes les commandes se lancent **sur ops01**, dans `/srv/infra/ansible`
(en production : le clone git du dépôt). `scripts/deploy` journalise chaque
exécution (qui, quoi, quand, résultat) dans `ops01:/var/log/central/ansible-executions.log`.

```bash
ssh <identifiant>@ops01          # via le VPN si vous êtes à l'extérieur
cd /srv/infra/ansible
```

Sommaire : [Reconstruire tout](#reconstruire-toute-linfrastructure) ·
[Personnes](#gestion-des-personnes) · [TrackR](#trackr) ·
[Restaurer](#restaurer-des-données) · [Annuaire AD](#un-contrôleur-de-domaine-est-en-panne) ·
[Liaison](#la-liaison-lille--dunkerque-est-coupée) · [Alertes](#que-faire-pour-chaque-alerte) ·
[Qui a fait quoi](#qui-a-fait-quoi-quand) · [Assureur](#preuve-de-mise-à-jour-pour-lassureur) ·
[Ajouter un site](#ajouter-un-site) · [Secrets](#secrets)

---

## Reconstruire toute l'infrastructure

**Labo** : `vagrant destroy -f && vagrant up` (sur le PC).

**Production** (serveurs neufs installés en Debian 12, IP
fixées comme dans `hosts.yml`) :

1. Sur une Debian neuve qui deviendra ops01 : cloner le dépôt dans `/srv/infra`,
   puis `sudo bash scripts/bootstrap-control.sh`.
2. Récupérer la clé du coffre (`.vault_pass`) dans le gestionnaire de mots de
   passe de l'entreprise et la poser dans `ansible/.vault_pass`.
3. Sur chaque serveur : créer l'utilisateur `ansible` avec la clé publique d'ops01
   (voir `LINUX_BOOTSTRAP` dans le `Vagrantfile`).
4. `bash ../scripts/deploy playbooks/site.yml` puis `playbooks/verifier.yml`.
5. Restaurer les données (TrackR, Paie) depuis bkp01 : voir plus bas.

Durée : environ 1 h, sans aucune connaissance préalable de l'installation.

---

## Gestion des personnes

Le fichier **`inventories/lab/personnel.csv`** est la seule source : les RH le
tiennent (il s'ouvre dans Excel, séparateur `;`), l'informatique l'applique.

| Situation | Modification dans `personnel.csv` | Effet au prochain déploiement |
|---|---|---|
| Arrivée | nouvelle ligne, statut `actif` | compte AD créé, groupes du service, mot de passe initial |
| Changement de poste (ex. quai → exploitation) | changer la colonne `service` | changement d'OU et de groupes, droits TrackR adaptés |
| Départ | statut `parti` | compte désactivé, déplacé dans `Desactives`, retiré de tous les groupes, VPN supprimé |
| Nouveau prestataire | ligne avec service `prestataire`, `fin_mission` et `entreprise` | compte dans l'annuaire prestataires, TrackR en lecture |
| Fin de mission | rien à faire | compte verrouillé automatiquement la nuit suivant `fin_mission` |

Appliquer :

```bash
bash ../scripts/deploy playbooks/site.yml --tags identites
```

Seuls les membres du service `informatique` reçoivent `GG_Admins_Linux`
(connexion et `sudo` sur les serveurs Linux) et un accès VPN.

---

## TrackR

### TrackR ne répond plus (alerte `TrackRIndisponible`)

Normalement impossible sans panne des **deux** serveurs. Les postes du quai
gardent les saisies (bandeau rouge « saisies gardées sur ce poste ») : les
camions ne sont pas bloqués.

1. `bash ../scripts/deploy playbooks/verifier.yml` pour voir ce qui répond.
2. Sur chaque serveur web : `systemctl status trackr nginx postgresql keepalived`.
3. Redémarrer ce qui est arrêté ; si un serveur est détruit, voir « Reconstruire ».
4. Dès que TrackR revient, les postes envoient seuls les saisies en attente.

### Un serveur TrackR est en panne (alerte `TrackRServeurEnPanne`)

Rien d'urgent pour l'activité : l'autre serveur a pris l'adresse TrackR et sa
base est devenue principale (message `trackr-bascule` dans le journal central).
Il n'y a plus de secours : réparer dans la journée.

### TrackR après une bascule

Quand le serveur tombé revient, sa base est **périmée** (il a manqué des
saisies). Il ne reprend pas la main tout seul (c'est voulu). Le remettre en
secours :

```bash
bash ../scripts/deploy playbooks/ops/trackr-reconstruire-secours.yml -e serveur=web01
```

(remplacer `web01` par le serveur qui était en panne). Le playbook refuse
d'écraser le serveur qui porte l'adresse TrackR.

Si `site.yml` s'arrête avec « Les deux serveurs se croient principaux », c'est
cette procédure qu'il faut faire.

---

## Restaurer des données

Les sauvegardes sont faites chaque nuit à 01:30 vers **bkp01 (Lille)**,
chiffrées. Conservation : 14 jours, 8 semaines, 12 mois.

| Données | Commande |
|---|---|
| Base TrackR (dernière sauvegarde) | `bash ../scripts/deploy playbooks/ops/restaurer-trackr.yml` |
| Base TrackR (date précise) | lister : `sudo borg list ssh://borg@bkp01.transnord.lan/srv/borg/depots/web01` (sur web01, `BORG_PASSCOMMAND="cat /root/.borg-passphrase"`) puis `-e archive=<nom>` |
| Partage Paie | sur dc01 : `borg extract ssh://borg@bkp01.transnord.lan/srv/borg/depots/dc01::<archive> srv/partages/paie` |
| Annuaire prestataires | sur ldap01 : extraire `ldap-donnees.ldif` puis `slapadd -n 1 -l ldap-donnees.ldif` (slapd arrêté) |
| Autorité de certification | sur ops01 : extraire `var/lib/transnord-pki` |
| Sauvegarde immédiate | `bash ../scripts/deploy playbooks/ops/sauvegarder-maintenant.yml` |

L'Active Directory existe en deux exemplaires (dc01, dc02) et son contenu (OU,
groupes, comptes) est recréé à l'identique par Ansible depuis `personnel.csv`.
En dernier recours, l'export complet nocturne (`samba-tool domain backup`) est
dans la sauvegarde de chaque DC (`samba-tool domain backup restore`).

---

## Un contrôleur de domaine est en panne

Les connexions basculent sur l'autre DC (les serveurs Linux connaissent les
deux, DC du site en premier). Pour reconstruire un DC détruit :

1. Sur le DC restant : `samba-tool domain demote --remove-other-dead-server=dc02`.
2. Réinstaller une Debian 12 avec la même IP (et l'utilisateur `ansible`).
3. `bash ../scripts/deploy playbooks/site.yml --limit dc02` (le premier DC de
   l'inventaire crée le domaine : s'il est perdu, mettre l'autre DC en premier
   dans le groupe `domain_controllers`).

---

## La liaison Lille ↔ Dunkerque est coupée

Alerte `LiaisonSiteCoupee`. Rien à faire côté serveurs :

- Dunkerque : TrackR, annuaire (dc01), tout fonctionne.
- Lille : connexions des postes via dc02 ; TrackR inaccessible depuis Lille.
- Les journaux de Lille sont mis en file d'attente et arrivent au retour.
- L'AD se resynchronise seul au retour de la liaison.

Contacter l'opérateur réseau. Pour la démonstration :
`playbooks/demo/couper-liaison.yml` / `retablir-liaison.yml`.

---

## Que faire pour chaque alerte

Les alertes arrivent par e-mail à `informatique@transnord.lan` (labo :
http://192.168.56.10:8025) et sont visibles sur http://192.168.56.10:3000.

| Alerte | Gravité | Action |
|---|---|---|
| TrackRIndisponible | critique | [TrackR ne répond plus](#trackr-ne-répond-plus-alerte-trackrindisponible) |
| TrackRServeurEnPanne | attention | réparer le serveur, puis [après une bascule](#trackr-après-une-bascule) |
| TrackRSansCopieDeSecours | attention | [après une bascule](#trackr-après-une-bascule) |
| LiaisonSiteCoupee | critique | [liaison coupée](#la-liaison-lille--dunkerque-est-coupée) |
| ServeurInjoignable | critique | vérifier l'hyperviseur, redémarrer la VM, `verifier.yml` |
| ControleurDeDomaineEnPanne | critique | [DC en panne](#un-contrôleur-de-domaine-est-en-panne) |
| AnnuairePrestatairesEnPanne | attention | `systemctl status slapd` sur ldap01, sinon `site.yml --limit ldap01` |
| DisqueBientotPlein / DisquePresquePlein | attention | `du -xh / \| sort -h \| tail` ; agrandir le disque |
| CertificatBientotExpire | attention | `site.yml --tags pki` puis le rôle concerné (renouvellement automatique à 30 jours) |
| SauvegardeTropAncienne / SauvegardeEnEchec | critique | `journalctl -u sauvegarde` sur le serveur, `sauvegarder-maintenant.yml` |
| MisesAJourDeSecuriteEnAttente | attention | `apt-get upgrade` ou laisser la nuit suivante ; voir `/var/log/unattended-upgrades/` |
| RedemarrageNecessaire | attention | redémarrer un dimanche (pas d'activité), un serveur web à la fois |

---

## Qui a fait quoi, quand

| Question | Où regarder |
|---|---|
| Qui a lancé Ansible, quelle commande, avec quel résultat | `ops01:/var/log/central/ansible-executions.log` |
| Qui s'est connecté à un serveur Linux | `ops01:/var/log/central/<serveur>/sshd.log` |
| Quelles commandes administrateur ont été tapées | `ops01:/var/log/central/<serveur>/audisp-syslog.log` (clé `commande_admin`), `/var/log/sudo.log` sur le serveur |
| Qui a saisi / consulté quoi dans TrackR, refus d'accès | TrackR → menu **Journal** (direction, informatique) |
| Qui a ouvert ou tenté d'ouvrir le partage Paie | `ops01:/var/log/central/dc01/` (fichiers smbd_audit et samba) |
| Quand une bascule TrackR a eu lieu | `grep trackr-bascule /var/log/central/web0*/*` |
| Ce que contenait la configuration avant | l'historique git du dépôt |

---

## Preuve de mise à jour pour l'assureur

- Les mises à jour de sécurité Debian s'installent chaque nuit (`unattended-upgrades`).
- Mise à jour complète mensuelle, un serveur à la fois (un dimanche) :
  `bash ../scripts/deploy playbooks/ops/mettre-a-jour.yml -e redemarrer=true`
- Rapport daté pour l'assureur : `bash ../scripts/deploy playbooks/ops/rapport-assureur.yml`
  → `ansible/reports/rapport-assureur-<date>.html`
- Le tableau de bord affiche « Mises à jour en attente » (objectif : 0) et l'âge
  de la dernière sauvegarde ; l'historique est conservé un an dans Prometheus.
- Détail par serveur : `/var/log/unattended-upgrades/unattended-upgrades.log`.

---

## Ajouter un site

Exemple : ouverture d'un entrepôt à Calais.

1. `group_vars/all/main.yml` → ajouter dans `sites` :
   ```yaml
   calais: { label: Calais, subnet: 192.168.56.128/26 }
   ```
2. `hosts.yml` → ajouter le groupe et son contrôleur de domaine :
   ```yaml
   site_calais:
     hosts:
       dc03: { ansible_host: 192.168.56.131, vm_memory: 512 }
   ```
   et `dc03` dans les groupes `linux` et `domain_controllers`.
3. `vagrant up dc03` (labo) ou installer le serveur (production).
4. `bash ../scripts/deploy playbooks/site.yml`

Ansible crée le site AD et son sous-réseau, promeut dc03 dans le site Calais,
lui émet un certificat, le met sous supervision et l'ajoute aux DNS/heure des
serveurs. Compter une demi-journée, matériel compris.

---

## Outils de contrôle

| Outil | Usage |
|---|---|
| `bash ../scripts/deploy playbooks/verifier.yml` | heure, DNS, domaine, sudo, TrackR, partage Paie |
| `bash /srv/infra/scripts/test-trackr.sh` | test complet de TrackR : connexions, droits, prestataires, saisie sans doublon |
| `python3 /srv/infra/scripts/promq.py 'up == 0'` | interroger la supervision en ligne de commande |
| http://192.168.56.10:9090/alerts | état de toutes les alertes |

---

## Secrets

- Tous les mots de passe sont dans `inventories/lab/group_vars/all/vault.yml`,
  chiffré. Voir : `ansible-vault view inventories/lab/group_vars/all/vault.yml`.
  Modifier : `ansible-vault edit …` puis `site.yml`.
- La clé du coffre (`ansible/.vault_pass`) n'est **jamais** dans git : elle est
  dans le gestionnaire de mots de passe de l'entreprise (deux personnes au moins
  y ont accès : l'informaticien et la direction).
- Compte de secours local `secours` sur chaque serveur, mot de passe dans le coffre.
