# Tuto : FRR et OSPF sur un tunnel WireGuard

> Accompagne le **MC2 : le réseau côté système**. Objectif : deux routeurs Debian, reliés par WireGuard, s'échangent automatiquement les réseaux de leur site grâce à OSPF.

## Le lab

```
client-a ── LAN A ── rtr-a ══ wg0 (via WAN) ══ rtr-b ── LAN B ── client-b
10.1.10.10  10.1.10.0/24   10.255.0.1   10.255.0.2   10.1.20.0/24  10.1.20.10
```

| | rtr-a | rtr-b |
|---|---|---|
| LAN | `eth1` · 10.1.10.1/24 | `eth1` · 10.1.20.1/24 |
| WAN | `eth2` · 192.0.2.1/24 | `eth2` · 192.0.2.2/24 |
| Tunnel | `wg0` · 10.255.0.1/30 | `wg0` · 10.255.0.2/30 |
| router-id | 10.255.0.1 | 10.255.0.2 |

> Les noms d'interface varient selon l'hyperviseur (`enp0s8`, `ens34`…). Vérifiez avec `ip -br a` et adaptez.

---

## 1. Les prérequis (avant de toucher à FRR)

Sur **chaque routeur** :

**Le routage est activé**

```bash
sysctl net.ipv4.ip_forward      # doit afficher 1
```

**Le tunnel WireGuard est monté**, avec les deux réglages propres au routage dynamique :

```ini
# /etc/wireguard/wg0.conf (rtr-a)
[Interface]
Address    = 10.255.0.1/30
ListenPort = 51820
PrivateKey = <clé privée rtr-a>
Table      = off                                   # OSPF pose les routes, pas wg-quick
PostUp     = ip link set dev %i multicast on       # OSPF envoie ses messages en multicast

[Peer]
PublicKey  = <clé publique rtr-b>
Endpoint   = 192.0.2.2:51820
AllowedIPs = 0.0.0.0/0                             # un seul pair : il accepte tout ce qu'OSPF lui envoie
```

Vérification : `wg show` (un « latest handshake » récent) et `ping 10.255.0.2` depuis rtr-a.

**Le pare-feu laisse passer WireGuard et OSPF** (chaîne `input`, donc vers le routeur lui-même) :

```
iifname "eth2" udp dport 51820 accept     # WireGuard sur le WAN
iifname "wg0"  ip protocol 89 accept      # OSPF (protocole IP n°89)
```

---

## 2. Installer et activer FRR

```bash
apt install frr
```

FRR regroupe plusieurs démons : un par protocole. Seul `zebra` (qui écrit les routes dans le noyau) est actif par défaut. Activez OSPF :

```bash
# /etc/frr/daemons
ospfd=yes
```

```bash
systemctl restart frr
systemctl status frr
```

---

## 3. Configurer OSPF

Toute la configuration tient dans **`/etc/frr/frr.conf`**.

**rtr-a**

```
frr defaults traditional
hostname rtr-a
!
interface wg0
 ip ospf network point-to-point
!
interface eth1
 ip ospf passive
!
router ospf
 ospf router-id 10.255.0.1
 network 10.255.0.0/30 area 0
 network 10.1.10.0/24 area 0
!
```

**rtr-b** : la même chose, avec `hostname rtr-b`, `router-id 10.255.0.2` et `network 10.1.20.0/24`.

Ce que veut dire chaque ligne :

| Ligne | Signification |
|---|---|
| `ip ospf network point-to-point` | Sur wg0, il n'y a qu'un seul voisin : pas besoin d'élire un routeur désigné. Indispensable sur un tunnel |
| `ip ospf passive` | On **annonce** le LAN, mais on n'y cherche pas de voisin OSPF (il n'y a que des clients) |
| `ospf router-id` | L'identifiant du routeur. **Il doit être unique** dans tout le réseau OSPF |
| `network … area 0` | Active OSPF sur les interfaces dont l'IP est dans ce réseau, et annonce ce réseau. Une seule aire : l'aire 0 |

Appliquez la configuration :

```bash
systemctl restart frr
```

---

## 4. Vérifier

Les commandes FRR se lancent avec **`vtysh`**, une console qui ressemble à celle d'un routeur Cisco.

```bash
vtysh -c "show ip ospf neighbor"
```

L'état doit être **`Full`**. C'est le signe que les deux routeurs se sont mis d'accord.

```
Neighbor ID     Pri State           Up Time  Dead Time Address      Interface
10.255.0.2        1 Full/-          2m10s      35.812s 10.255.0.2   wg0:10.255.0.1
```

```bash
vtysh -c "show ip route ospf"     # routes apprises par OSPF
ip route                          # les mêmes routes, dans le noyau, avec "proto ospf"
```

Sur rtr-a, on doit voir `10.1.20.0/24 via 10.255.0.2 dev wg0`.

Le test final, depuis client-a :

```bash
traceroute 10.1.20.10
# 1  10.1.10.1   (rtr-a)
# 2  10.255.0.2  (rtr-b)
# 3  10.1.20.10  (client-b)
```

---

## 5. Dépanner

| Symptôme | Causes probables | À vérifier |
|---|---|---|
| Aucun voisin dans `show ip ospf neighbor` | Pare-feu (protocole 89), multicast désactivé sur wg0, tunnel en panne | `wg show`, `ip link show wg0` (flag MULTICAST), `nft list ruleset`, `tcpdump -ni wg0 ip proto 89` |
| Voisin bloqué en `ExStart` ou `Exchange` | MTU différente des deux côtés | `ip link show wg0` des deux côtés. Pour tester : `ip ospf mtu-ignore` sur wg0 |
| Voisin en `Full`, mais pas de route | Ligne `network` manquante ou mauvaise, réseau du LAN non annoncé | `vtysh -c "show running-config"`, `show ip ospf interface` |
| Deux routeurs ne se voient pas, alors que tout semble correct | Même `router-id` des deux côtés | `vtysh -c "show ip ospf"` |
| Les routes existent, mais le ping entre clients échoue | Routage désactivé, chaîne `forward` de nftables, passerelle des clients | `sysctl net.ipv4.ip_forward`, `nft list chain inet filter forward`, `ip route` sur les clients |
| Le ping passe, SSH ou HTTP se figent | MTU du tunnel (1420) | `ping -M do -s 1372 10.1.20.10` |

Pour voir OSPF discuter :

```bash
vtysh
  conf t
  debug ospf packet hello
  end
exit
journalctl -u frr -f
```

---

## 6. Le faire avec Ansible

La configuration FRR est un simple fichier texte : on le génère avec un template, à partir de l'inventaire.

```yaml
# host_vars/rtr-a.yml
ospf_router_id: 10.255.0.1
ospf_networks:
  - 10.255.0.0/30
  - 10.1.10.0/24
ospf_p2p_interfaces: [wg0]
ospf_passive_interfaces: [eth1]
```

```jinja
{# roles/frr/templates/frr.conf.j2 #}
frr defaults traditional
hostname {{ inventory_hostname }}
!
{% for itf in ospf_p2p_interfaces %}
interface {{ itf }}
 ip ospf network point-to-point
!
{% endfor %}
{% for itf in ospf_passive_interfaces %}
interface {{ itf }}
 ip ospf passive
!
{% endfor %}
router ospf
 ospf router-id {{ ospf_router_id }}
{% for net in ospf_networks %}
 network {{ net }} area 0
{% endfor %}
!
```

```yaml
# roles/frr/tasks/main.yml (extrait)
- name: Activer ospfd
  ansible.builtin.lineinfile:
    path: /etc/frr/daemons
    regexp: '^ospfd='
    line: 'ospfd=yes'
  notify: Redémarrer frr

- name: Configuration FRR
  ansible.builtin.template:
    src: frr.conf.j2
    dest: /etc/frr/frr.conf
    owner: frr
    group: frr
    mode: "0640"
  notify: Redémarrer frr
```

> `systemctl reload frr` applique la configuration sans couper les voisinages, mais demande le paquet `frr-pythontools`. Sinon, un redémarrage fonctionne très bien pour le TP.

---

## 7. Ajouter un 3e site

C'est tout l'intérêt d'OSPF. Pour un rtr-c avec son LAN 10.1.30.0/24 :

1. Un nouveau tunnel WireGuard entre rtr-c et rtr-a (ou rtr-b), avec son propre petit réseau (`10.255.0.4/30`).
2. Sur rtr-c : son `frr.conf`, avec ses réseaux et un `router-id` unique.
3. Sur le routeur auquel il se raccroche : ajouter la nouvelle interface WireGuard et la ligne `network` du nouveau tunnel.

**Rien à toucher sur les routes des autres routeurs** : le LAN 10.1.30.0/24 apparaît tout seul dans leur table de routage.

> Avec un seul pair par interface WireGuard (`AllowedIPs = 0.0.0.0/0`), il faut **une interface wg par tunnel** (`wg0`, `wg1`…).

---

## Pour aller plus loin

- La documentation officielle d'OSPF dans FRR : https://docs.frrouting.org/en/latest/ospfd.html
- Les commandes `vtysh` les plus utiles : `show ip ospf interface`, `show ip ospf database`, `show running-config`
