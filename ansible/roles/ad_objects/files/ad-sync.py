#!/usr/bin/python3
"""Aligne l'annuaire AD (Samba) sur l'état voulu décrit en JSON.

Entrée (fichier JSON) : ous, groups {nom: description}, users [...], members {groupe: [logins]}
Sortie (JSON) : {"changed": bool, "changes": [...]}  -- utilisé par Ansible.
Idempotent : ne fait que ce qui manque ou diffère.
"""
import json
import sys

import ldb
from samba.auth import system_session
from samba.param import LoadParm
from samba.samdb import SamDB

desired = json.load(open(sys.argv[1], encoding="utf-8"))
lp = LoadParm()
lp.load_default()
samdb = SamDB(url="/var/lib/samba/private/sam.ldb", session_info=system_session(), lp=lp)
base = str(samdb.domain_dn())
changes = []


def exists(dn):
    try:
        return len(samdb.search(base=dn, scope=ldb.SCOPE_BASE, attrs=["dn"])) == 1
    except ldb.LdbError:
        return False


def find(sam):
    res = samdb.search(base=base, scope=ldb.SCOPE_SUBTREE,
                       expression=f"(sAMAccountName={ldb.binary_encode(sam)})",
                       attrs=["dn", "userAccountControl", "department", "memberOf", "member"])
    return res[0] if res else None


# 1. Unités d'organisation (de la plus haute à la plus basse)
for ou in desired["ous"]:
    dn = f"{ou},{base}"
    if not exists(dn):
        samdb.create_ou(dn)
        changes.append(f"OU créée : {ou}")

# 2. Groupes
for name, descr in desired["groups"].items():
    if find(name) is None:
        samdb.newgroup(name, groupou=desired["groups_ou"], description=descr)
        changes.append(f"groupe créé : {name}")

# 3. Comptes
for u in desired["users"]:
    sam, ou = u["login"], u["ou"]
    entry = find(sam)
    if entry is None:
        samdb.newuser(sam, u["password"], givenname=u.get("first"), surname=u.get("last"),
                      userou=ou, useusernameascn=True, description=u.get("description"),
                      department=u.get("department"))
        changes.append(f"compte créé : {sam}")
        entry = find(sam)
    target = f"CN={sam},{ou},{base}"
    if str(entry.dn).lower() != target.lower():
        samdb.rename(entry.dn, ldb.Dn(samdb, target))
        changes.append(f"compte déplacé : {sam} -> {ou}")
        entry = find(sam)
    if str(entry.get("department", idx=0) or "") != (u.get("department") or ""):
        m = ldb.Message(entry.dn)
        m["department"] = ldb.MessageElement(u["department"], ldb.FLAG_MOD_REPLACE, "department")
        samdb.modify(m)
        changes.append(f"service mis à jour : {sam} -> {u['department']}")
    disabled = bool(int(str(entry["userAccountControl"][0])) & 0x2)
    if u["enabled"] and disabled:
        samdb.enable_account(f"(sAMAccountName={sam})")
        changes.append(f"compte réactivé : {sam}")
    if not u["enabled"] and not disabled:
        samdb.disable_account(f"(sAMAccountName={sam})")
        changes.append(f"compte désactivé : {sam}")
    if u.get("never_expires"):
        samdb.setexpiry(f"(sAMAccountName={sam})", 0, no_expiry_req=True)

# 4. Membres des groupes : exactement la liste voulue
for group, wanted in desired["members"].items():
    g = find(group)
    current = set()
    for member_dn in g.get("member") or []:
        res = samdb.search(base=str(member_dn), scope=ldb.SCOPE_BASE, attrs=["sAMAccountName"])
        if res:
            current.add(str(res[0]["sAMAccountName"][0]).lower())
    wanted_set = {w.lower() for w in wanted}
    to_add = sorted(wanted_set - current)
    to_remove = sorted(current - wanted_set)
    if to_add:
        samdb.add_remove_group_members(group, to_add, add_members_operation=True)
        changes.append(f"{group} : + {', '.join(to_add)}")
    if to_remove:
        samdb.add_remove_group_members(group, to_remove, add_members_operation=False)
        changes.append(f"{group} : - {', '.join(to_remove)}")

print(json.dumps({"changed": bool(changes), "changes": changes}, ensure_ascii=False))
