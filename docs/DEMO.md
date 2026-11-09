# Démonstration technique

Le mode d'emploi pas à pas des **3 démos de la soutenance** (environ 5 minutes), puis
les autres scénarios disponibles. Les mêmes consignes sont dans les notes orateur du
PowerPoint.

Deux façons de lancer les commandes :

| Où | Comment lancer un playbook |
|---|---|
| À l'école (vraies VM, Windows compris) | `ansible-playbook <playbook>.yml` depuis la racine du dépôt |
| Labo sur le PC (partie Linux) | `vagrant ssh ctl`, puis `bash /srv/loginord/lab/deploy.sh <playbook>.yml` |

Ci-dessous, les commandes sont écrites façon école ; dans le labo, remplacer
`ansible-playbook X.yml` par `bash /srv/loginord/lab/deploy.sh X.yml`.

---

## 1. Préparation

### La veille

1. Tout déployer, puis vérifier :
   ```bash
   ansible-playbook site.yml
   ansible-playbook verifier.yml
   ```
   Labo : `cd lab`, `vagrant up`, puis le `verifier.yml` dans ctl.
2. Faire confiance à l'autorité interne sur le PC de démonstration (sinon le navigateur
   refuse TrackR). Le certificat est sur le poste Ansible : `~/.loginord-pki/loginord-ca.crt`.
   Sous Windows : `certutil -user -addstore Root loginord-ca.crt` (Windows demande confirmation).
3. Noter les comptes de démonstration : `ansible-vault view vault/secrets.yml`
   (labo : ajouter `--vault-password-file lab/.lab/vault_pass`). À l'école, connexion à
   TrackR avec un compte AD de l'exploitation (`david.lambert`) ; dans le labo,
   avec un compte de `vault_trackr_local_users`.

### Le jour J, 15 minutes avant

1. Démarrer les VM (labo : `cd lab` puis `vagrant up --no-provision`). Fermer Discord et
   les onglets inutiles : la mémoire du PC est juste.
2. Ouvrir dans le navigateur :
   - **TrackR** : https://trackr.loginord.internal (labo : https://localhost:8443), connecté
   - **Tableau de bord** : http://10.1.20.30:3000 (labo : http://localhost:3000)
   - **Boîte mail des alertes** : labo http://localhost:8025 (vider les anciens e-mails)
3. Un terminal sur le poste Ansible, à la racine du dépôt (labo : `vagrant ssh ctl`).

---

## 2. Les 3 démos

### Démo 1 : TrackR plante, les camions ne le voient pas (≈ 1 min 30)

| # | Où | Geste | Ce que le public voit |
|---|---|---|---|
| 1 | TrackR | Créer une expédition (référence `LN-2001`, client, origine, destination, date) | Elle apparaît dans la liste |
| 2 | Terminal | `ansible-playbook demo-panne-trackr.yml` | « TrackR tué (PID …), relancé seul par systemd (PID …) » |
| 3 | TrackR | Rafraîchir la page | Tout est là, l'expédition aussi |

À dire : « J'ai tué le programme de la façon la plus brutale qui existe. Il est revenu
tout seul en 5 secondes, et la supervision l'a vu. Avant, c'était une heure d'arrêt. »

### Démo 2 : la liaison Lille ↔ Dunkerque tombe (≈ 2 min)

| # | Où | Geste | Ce que le public voit |
|---|---|---|---|
| 1 | Terminal | `ansible-playbook demo-couper-liaison.yml` | « Liaison coupée » |
| 2 | TrackR | Créer une 2e expédition | Ça marche : TrackR, sa base et le DC de Dunkerque sont sur place |
| 3 | Tableau de bord | Attendre ~1 min | **Liaison Lille - Dunkerque : COUPÉE** |
| 4 | Boîte mail | Ouvrir l'e-mail | « [FIRING] Le tunnel Lille - Dunkerque est coupé » |
| 5 | Terminal | `ansible-playbook demo-couper-liaison.yml -e retablir=oui` | La liaison revient, OSPF réapprend les routes |

À dire : « Dunkerque continue de travailler, et l'informatique est prévenue avant que
quelqu'un appelle. »

### Démo 3 : un sinistre efface tout, on récupère tout (≈ 1 min 30)

| # | Où | Geste | Ce que le public voit |
|---|---|---|---|
| 1 | Terminal | `ansible-playbook demo-sinistre-trackr.yml` | « Toutes les expéditions effacées » |
| 2 | TrackR | Rafraîchir | « Aucune expédition. » |
| 3 | Terminal | `ansible-playbook restaurer-trackr.yml -e cible=trackr -e confirmer=oui` | « N expéditions restaurées dans la base trackr » |
| 4 | TrackR | Rafraîchir | Tout est revenu |

À dire : « La base est sauvegardée toutes les heures, et une copie part à Lille. Le
serveur de compta qui tombe et trois jours à la main, c'est fini. »

Le playbook du sinistre fait d'abord la sauvegarde de l'heure : la restauration
ramène donc aussi les expéditions créées pendant les démos 1 et 2.

---

## 3. Remettre en état après la soutenance

```bash
ansible-playbook demo-couper-liaison.yml -e retablir=oui    # si la démo 2 a été interrompue
ansible-playbook verifier.yml
```

Éteindre proprement le labo : `cd lab` puis `vagrant halt`.

---

## 4. Autres scénarios (questions du jury)

| Scénario | Commande | Ce qu'on voit |
|---|---|---|
| Prouver la sauvegarde sans rien toucher | `ansible-playbook restaurer-trackr.yml` | Restauration dans une base de test, nombre d'expéditions |
| Disque plein (MC15) | `ansible-playbook demo-disque-plein.yml` puis `-e nettoyer=oui` | L'alerte « moins de 10 % libre » arrive au bout de 5 min |
| Rapport pour l'assureur (MC14) | `ansible-playbook rapport-assureur.yml` | `reports/rapport-assureur-<date>.html` |
| Tout redéployer à l'identique | `ansible-playbook site.yml` | `changed=0` partout |
| Mobilité, départ (MC13, école) | modifier `data/personnel.yml` puis `ansible-playbook personnel.yml` | Compte déplacé, groupes remplacés ; un parti ne se connecte plus |
| Admin Linux par l'AD (MC6, école) | `ssh adm-chloe.leroy@web01` puis `sudo -i` | Accepté ; refusé pour `david.lambert` |
| Prestataire (MC7) | `ldapsearch -x -ZZ -H ldap://ldap01 ...` (voir README) | Sa fiche, en chiffré ; refusé sans `-ZZ` |
