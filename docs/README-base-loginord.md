# loginord-infra

Le dépôt Ansible de LogiNord. Il construit, depuis des VMs vides : les deux routeurs et leur tunnel, le socle des serveurs Linux et Windows, puis le domaine Active Directory sur les deux sites.

## Ce que fait le dépôt

| Rôle | Machines | Ce qu'il fait | Cours |
|---|---|---|---|
| `baseline` | toutes | Nom d'hôte, fuseau horaire, NTP, compte admin, clé SSH (Linux et Windows) | MC1 |
| `ssh_hardening` | Linux | SSH par clé uniquement, pas de root, groupe autorisé | MC3 |
| `network` | Linux | IP fixes (systemd-networkd), routes vers les autres sites | MC2 |
| `router` | routeurs | Routage activé, pare-feu nftables, NAT vers Internet | MC2 |
| `wireguard` | routeurs | Tunnel chiffré entre les deux sites | MC2 |
| `frr` | routeurs | OSPF : chaque site annonce son réseau | MC2 |
| `win_network` | Windows | IP fixe et routes vers les autres sites | MC4 |
| `ad_forest` | dc01 | Création de la forêt `loginord.internal` | MC4 |
| `ad_dns` | dc01 | Zones inverses, enregistrements, redirecteurs | MC4 |
| `ad_structure` | dc01 | OU, groupes AGDLP, utilisateurs de test | MC4 |
| `ad_sites` | dc01 | Sites Lille et Dunkerque, sous-réseaux, lien de site | MC5 |
| `ad_dhcp` | dc01 | DHCP du site A, autorisé dans AD | MC4 |
| `ad_replica` | dc02 | Promotion de DC02 dans le site Dunkerque | MC5 |
| `ad_ldaps` | dc01, dc02 | Un certificat pour LDAPS : sans lui, Windows Server 2025 refuse TrackR et les Linux | MC4 |

---

## 1. Prérequis

**Sur votre machine (le « contrôleur » Ansible)** : Linux, macOS ou WSL.

```bash
python3 -m pip install ansible-core pywinrm
ansible-galaxy collection install -r requirements.yml
```

**Les VMs, créées à la main** (c'est le seul geste manuel, voir le MC1) :

| Système | Préparation minimale |
|---|---|
| Debian 13 | Un utilisateur `debian` avec sudo, votre clé SSH dans `~debian/.ssh/authorized_keys`, une interface NAT + les interfaces internes |
| Windows Server 2025 Core (image **en anglais** conseillée) | Mot de passe du compte `Administrator` défini, WinRM actif (c'est le cas par défaut), une interface NAT + l'interface du LAN |

Routeurs : 3 interfaces (NAT, LAN du site, WAN). Serveurs : 2 interfaces (NAT, LAN du site).

## 2. Adapter le dépôt à VOS machines

| Fichier | Quoi changer |
|---|---|
| `host_vars/*.yml` → `ansible_host` | L'IP de l'interface NAT de chaque VM |
| `group_vars/routers.yml` | Les noms d'interfaces des routeurs (`ip -br a` sur la VM) |
| `host_vars/rtr-a.yml`, `rtr-b.yml` | Les noms d'interfaces dans `interfaces:` |
| `group_vars/windows.yml` → `win_lan_alias` | Le nom de la carte LAN sous Windows (`Get-NetAdapter`) |

## 3. Les clés WireGuard

Sur n'importe quelle machine qui a `wireguard-tools` :

```bash
wg genkey | tee rtr-a.key | wg pubkey > rtr-a.pub
wg genkey | tee rtr-b.key | wg pubkey > rtr-b.pub
```

- Le contenu de `rtr-a.key` et `rtr-b.key` va dans le vault (étape suivante).
- La clé **publique de rtr-b** va dans `host_vars/rtr-a.yml` (`wg_peer_pubkey`), et inversement.
- Supprimez ensuite les fichiers `.key` : ils ne doivent jamais arriver dans Git.

## 4. Le vault

```bash
cp vault/secrets.example.yml vault/secrets.yml
nano vault/secrets.yml                     # on y met mots de passe et clés
ansible-vault encrypt vault/secrets.yml
echo 'votre-mot-de-passe-de-vault' > ~/.vault_pass && chmod 600 ~/.vault_pass
```

> Gardez **le même mot de passe Administrator sur DC01 et DC02**. À la création de la forêt, celui de DC01 devient le mot de passe de l'administrateur du domaine, et DC02 s'en sert pour rejoindre le domaine.

## 5. Vérifier qu'Ansible joint tout le monde

```bash
ansible linux -m ansible.builtin.ping
ansible windows -m ansible.windows.win_ping -e @vault/secrets.yml --vault-password-file ~/.vault_pass
```

## 6. Déployer, dans l'ordre

```bash
export ANSIBLE_VAULT_PASSWORD_FILE=~/.vault_pass

ansible-playbook site.yml --tags socle      # les fondations : baseline et SSH partout
ansible-playbook site.yml --tags routeurs   # le réseau, le pare-feu, le tunnel, OSPF
ansible-playbook site.yml --tags dc01       # la forêt et tout ce qui va avec
ansible-playbook site.yml --tags dc02       # DC02 passe contrôleur de domaine

ansible-playbook site.yml                   # ou tout d'un coup, pour les pressés
```

**Le test qui compte :** relancez `ansible-playbook site.yml`. Le récapitulatif doit afficher `changed=0` partout.

## 7. Vérifier que ça marche

| Brique | Commande | Résultat attendu |
|---|---|---|
| Tunnel | `sudo wg show` sur rtr-a | `latest handshake` de moins de 2 minutes |
| OSPF | `sudo vtysh -c "show ip route ospf"` sur rtr-a | Une ligne `O>* 10.1.20.0/24 via 10.255.0.2` |
| Routage | `tracert 10.1.20.10` depuis dc01 (ou `traceroute` depuis un Debian du site A) | rtr-a, puis 10.255.0.2, puis la cible |
| SSH | `ssh root@rtr-a` | Refusé |
| AD | `Get-ADDomain` sur dc01 | Le domaine `loginord.internal` |
| Sites | `nltest /dsgetsite` sur dc02 | `Dunkerque` |
| Réplication | `repadmin /replsummary` sur dc01 | 0 échec |
| DNS | `nslookup trackr.loginord.internal 10.1.20.10` | 10.1.20.20 |
| DHCP | `Get-DhcpServerv4Scope` sur dc01 | L'étendue 10.1.10.0 |
| LDAPS | `openssl s_client -connect dc01.loginord.internal:636` depuis un Debian | Le certificat `CN=dc01.loginord.internal` |

## 8. Ajouter une machine (web01, db01…)

1. Créez la VM.
2. Copiez `host_vars/_modeles/web01.yml` vers `host_vars/<machine>.yml` et adaptez l'IP.
3. Décommentez la machine dans `inventory/hosts.yml`, **dans tous les groupes** où elle apparaît.
4. `ansible-playbook site.yml --limit <machine>`

## Dépannage

| Symptôme | Piste |
|---|---|
| `UNREACHABLE` sur un Linux | `ansible_host` faux, ou la clé SSH n'est pas sur la VM |
| `UNREACHABLE` sur un Windows | WinRM : `winrm quickconfig` sur la VM, port 5985 ouvert, `pywinrm` installé |
| Pas de handshake WireGuard | Clés publiques inversées, ou les routeurs ne se joignent pas sur le WAN (`ping 192.0.2.2`) |
| OSPF sans voisin | Le pare-feu (protocole 89 sur wg0) ou le multicast sur wg0 : voir `../TUTO_FRR_OSPF.md` |
| Plus de main sur une VM après le rôle `network` | Mauvais nom d'interface : vous avez reconfiguré l'interface NAT. Passez par la console de l'hyperviseur |
| `ad_forest` échoue juste après le redémarrage | AD n'est pas encore prêt. Le rôle attend jusqu'à 10 minutes : relancez simplement |
| La promotion de DC02 échoue | DC02 ne joint pas DC01 : testez `Test-NetConnection 10.1.10.10 -Port 389` depuis DC02 (routes, tunnel, pare-feu) |
| Windows en français | Remplacez `Administrator` par `Administrateur` et `Administrators` par `Administrateurs` (`group_vars/windows.yml`, rôle `baseline`) |

## À ne jamais committer

- `vault/secrets.yml` **non chiffré**
- `~/.vault_pass` ou tout mot de passe de vault
- les clés privées WireGuard (`*.key`)
