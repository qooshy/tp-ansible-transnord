# Démonstration technique

Ce document est le mode d'emploi pas à pas des **3 démos de la soutenance**
(environ 5 minutes), puis la liste des autres scénarios disponibles. Les mêmes
consignes sont dans les notes orateur du PowerPoint (slides 4, 5 et 6).

---

## 1. Préparation

### Une seule fois (la veille)

1. Sur le PC, dans le dossier du projet :
   ```bash
   vagrant up
   ```
   Si le dossier du projet a été déplacé depuis le dernier `vagrant up`,
   redémarrer ops01 pour qu'il retrouve le dépôt :
   ```bash
   vagrant reload ops01 --no-provision
   ```
2. Faire confiance à l'autorité de certification de l'entreprise (sinon le
   navigateur refuse TrackR). Windows demande une confirmation :
   ```bash
   certutil -user -addstore Root transnord-ca.crt
   ```
3. Vérifier que tout est vert :
   ```bash
   vagrant ssh ops01 -c "cd /srv/infra/ansible && bash ../scripts/deploy playbooks/verifier.yml"
   ```
4. Noter les mots de passe de démonstration :
   ```bash
   vagrant ssh ops01 -c "cd /srv/infra/ansible && ansible-vault view inventories/lab/group_vars/all/vault.yml"
   ```
   - `vault_users_initial_password` : mot de passe de tous les salariés
   - `vault_prestataires_password` : mot de passe des prestataires

### Le jour J, 15 minutes avant

1. Démarrer les VM : `vagrant up --no-provision`
2. Ouvrir dans le navigateur, un onglet chacun :
   - **TrackR** : https://192.168.56.20, connecté en `j.moreau` (agent de quai)
   - **Tableau de bord** : http://192.168.56.10:3000
   - **Boîte mail des alertes** : http://192.168.56.10:8025 (vider les anciens e-mails)
3. Ouvrir deux terminaux :
   - **Terminal PC** : dans le dossier du projet (pour `vagrant halt`)
   - **Terminal ops01** : `vagrant ssh ops01`, puis `cd /srv/infra/ansible`
4. Vérifier que TrackR affiche en bas « Servi par **web01** ».

---

## 2. Les 3 démos

### Démo 1 : un serveur TrackR tombe, les camions ne sont pas bloqués (≈ 2 min, slide 4)

| # | Où | Geste | Ce que le public voit |
|---|---|---|---|
| 1 | TrackR | Saisir camion `AB-123-CD`, référence `EXP-0001`, heure prévue 30 min plus tôt, cliquer **Arrivée** | La ligne apparaît, marquée **RETARD** ; « Servi par web01 » |
| 2 | Terminal PC | `vagrant halt web01 --force` | « Je débranche le serveur principal. » |
| 3 | TrackR | Attendre 10 à 15 s | Bandeau rouge quelques secondes, puis **« Connecté - serveur web02 »** |
| 4 | TrackR | Saisir un 2e camion, cliquer **Arrivée** | La saisie passe normalement |

À dire : « Personne n'a rien fait. Et l'équipe informatique vient de recevoir
un e-mail. » L'e-mail arrive en environ 1 minute : on le montre pendant la démo 2.

**Si la bascule ne se fait pas** : montrer la capture du tableau de bord
(slide 9) et passer à la suite ; réparer après la soutenance.

### Démo 2 : la liaison Lille ↔ Dunkerque est coupée (≈ 1 min 30, slide 5)

| # | Où | Geste | Ce que le public voit |
|---|---|---|---|
| 1 | Terminal ops01 | `bash ../scripts/deploy playbooks/demo/couper-liaison.yml` | « Liaison coupée » en fin d'exécution |
| 2 | TrackR | Saisir un 3e camion | Ça marche : Dunkerque travaille seul |
| 3 | Tableau de bord | Attendre ~1 min | **Liaison Lille - Dunkerque : COUPÉE** |
| 4 | Boîte mail | Ouvrir les e-mails | « Le serveur TrackR web01 ne répond plus » (démo 1) et « Site lille injoignable » |
| 5 | Terminal ops01 | `bash ../scripts/deploy playbooks/demo/retablir-liaison.yml` | La liaison revient |

À dire : « Vous êtes prévenu avant que vos clients appellent. »

### Démo 3 : les fiches de paie (≈ 1 min, slide 6)

Dans le terminal ops01. Chaque commande demande le mot de passe :
taper `vault_users_initial_password` (il ne s'affiche pas à l'écran).

| # | Geste | Ce que le public voit |
|---|---|---|
| 1 | La comptable : `smbclient //dc01.transnord.lan/Paie -U 'TRANSNORD\c.martin' --client-protection=encrypt -c ls` | `tree connect failed: NT_STATUS_ACCESS_DENIED` |
| 2 | La responsable RH : `smbclient //dc01.transnord.lan/Paie -U 'TRANSNORD\s.lefebvre' --client-protection=encrypt -c ls` | La fiche `Fiche_paie_2026-10_Durand.txt` |

À dire : « La tentative de la comptable est enregistrée avec son nom et l'heure. »
Pour le montrer si on vous le demande :
```bash
sudo grep -h c.martin /var/log/central/dc01/* | tail -3
```

---

## 3. Remettre en état après la soutenance

Sur le PC :
```bash
vagrant up web01 --no-provision
```
Puis dans le terminal ops01 (web01 redevient la copie de secours de web02) :
```bash
bash ../scripts/deploy playbooks/ops/trackr-reconstruire-secours.yml -e serveur=web01
```
Si la démo 2 a été interrompue :
```bash
bash ../scripts/deploy playbooks/demo/retablir-liaison.yml
```

---

## 4. Autres scénarios disponibles (questions du jury)

| Scénario | Commande / geste | Ce que l'on voit |
|---|---|---|
| Aucun serveur TrackR ne répond | `vagrant halt web01 web02 --force` puis saisir 2 camions | « 2 saisies gardées sur ce poste » ; `vagrant up web01 web02` → les saisies arrivent seules, sans doublon |
| Sinistre et restauration | `demo/sinistre-trackr.yml` puis `ops/restaurer-trackr.yml` | Liste vide, puis données revenues depuis Lille |
| Changement de poste | `personnel.csv` : `t.roux` `quai` → `exploitation`, puis `site.yml --tags identites` | Ansible liste le compte déplacé et les groupes changés |
| Prestataire | Connexion TrackR `p.dupont` (lecture seule, pas de noms) ; `k.lambert` (mission finie) | `k.lambert` : « Identifiant ou mot de passe incorrect » |
| Qui a fait quoi | TrackR → Journal ; `tail /var/log/central/ansible-executions.log` | Toutes les actions avec nom, heure, origine |
| Preuve pour l'assureur | `ops/rapport-assureur.yml` | Page HTML `ansible/reports/rapport-assureur-<date>.html` à ouvrir sur le PC |
| Test complet de TrackR | `bash /srv/infra/scripts/test-trackr.sh` | Chaque règle d'accès vérifiée, OK / ÉCHEC |
