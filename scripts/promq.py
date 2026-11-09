#!/usr/bin/env python3
"""Interroge Prometheus : python3 scripts/promq.py 'requête'"""
import json, sys, urllib.parse, urllib.request
q = urllib.parse.urlencode({"query": sys.argv[1]})
d = json.load(urllib.request.urlopen(f"http://localhost:9090/api/v1/query?{q}"))
for r in d["data"]["result"]:
    print({k: v for k, v in r["metric"].items() if k not in ("__name__",)}, r["value"][1])
