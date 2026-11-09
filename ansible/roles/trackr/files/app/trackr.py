"""TrackR - suivi des expéditions (arrivées, départs, retards).

Principes :
  * chaque saisie porte un identifiant unique créé sur le poste du quai : si le
    réseau ou le serveur tombe, le navigateur garde la saisie et la renvoie
    plus tard, sans jamais créer de doublon ;
  * rien n'est jamais modifié ni effacé : on ajoute (journal immuable) ;
  * salariés authentifiés par l'Active Directory, prestataires par l'annuaire
    OpenLDAP dédié ; les droits viennent des groupes ;
  * chaque connexion, refus et saisie est tracé (qui, quoi, quand, d'où).
"""
import datetime as dt
import os
import re
import socket
import ssl
import uuid
from functools import wraps

import psycopg2
import psycopg2.extras
from flask import (Flask, Response, abort, g, jsonify, redirect,
                   render_template, request, session, url_for)
from ldap3 import FIRST, Connection, Server, ServerPool, Tls
from ldap3.utils.conv import escape_filter_chars

ENV = os.environ
NODE = socket.gethostname()
LATE_MINUTES = int(ENV.get("TRACKR_LATE_MINUTES", "15"))
AD_SERVERS = [s for s in ENV.get("TRACKR_AD_SERVERS", "").split(",") if s]
AD_DOMAIN = ENV.get("TRACKR_AD_DOMAIN", "")
AD_BASE = ENV.get("TRACKR_AD_BASE", "")
PRESTA_SERVER = ENV.get("TRACKR_PRESTA_SERVER", "")
PRESTA_BASE = ENV.get("TRACKR_PRESTA_BASE", "")
CA_FILE = ENV.get("TRACKR_CA_FILE", "/etc/ssl/certs/ca-certificates.crt")
WRITERS = set(ENV.get("TRACKR_WRITER_GROUPS", "").split(","))
READERS = set(ENV.get("TRACKR_READER_GROUPS", "").split(","))
AUDITORS = set(ENV.get("TRACKR_AUDIT_GROUPS", "").split(","))
LOGIN_RE = re.compile(r"^[a-z0-9._-]{2,40}$")

app = Flask(__name__)
app.secret_key = ENV["TRACKR_SECRET_KEY"]          # identique sur les 2 serveurs
app.config.update(SESSION_COOKIE_SECURE=True, SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SAMESITE="Lax",
                  PERMANENT_SESSION_LIFETIME=dt.timedelta(hours=12))


# --------------------------------------------------------------- base de données
def db():
    if "db" not in g:
        g.db = psycopg2.connect(dbname="trackr", connect_timeout=3)
        g.db.autocommit = True
    return g.db


@app.teardown_appcontext
def _close(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def query(sql, args=(), one=False):
    with db().cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, args)
        rows = cur.fetchall() if cur.description else []
    return (rows[0] if rows else None) if one else rows


def is_primary():
    return not query("SELECT pg_is_in_recovery() AS r", one=True)["r"]


def audit(action, detail="", user=None):
    try:
        query("INSERT INTO audit_log (username, action, detail, source_ip, node) VALUES (%s,%s,%s,%s,%s)",
              (user or session.get("user"), action, detail, request.remote_addr, NODE))
    except psycopg2.Error:
        app.logger.warning("audit impossible (base en lecture seule ?) : %s %s", action, detail)
    app.logger.info("AUDIT user=%s action=%s detail=%s ip=%s", user or session.get("user"), action, detail,
                    request.remote_addr)


# --------------------------------------------------------------- authentification
def _tls():
    return Tls(ca_certs_file=CA_FILE, validate=ssl.CERT_REQUIRED, version=ssl.PROTOCOL_TLS_CLIENT)


def auth_employee(login, password):
    """Salarié : annuaire Active Directory (DC du site d'abord, puis les autres)."""
    servers = [Server(h, port=636, use_ssl=True, tls=_tls(), connect_timeout=3) for h in AD_SERVERS]
    if not servers:
        return None
    conn = Connection(ServerPool(servers, FIRST, active=1, exhaust=True), user=f"{login}@{AD_DOMAIN}",
                      password=password, receive_timeout=5)
    try:
        if not conn.bind():
            return None
        conn.search(AD_BASE, f"(sAMAccountName={escape_filter_chars(login)})",
                    attributes=["displayName", "memberOf"])
        if not conn.entries:
            return None
        entry = conn.entries[0]
        groups = {re.sub(r"^CN=([^,]+),.*$", r"\1", str(m)) for m in entry.memberOf.values}
        name = str(entry.displayName) if entry.displayName else login
    except Exception as exc:  # annuaire injoignable
        app.logger.warning("AD injoignable : %s", exc)
        return None
    finally:
        conn.unbind()
    if groups & WRITERS:
        role = "ecriture"
    elif groups & READERS:
        role = "lecture"
    else:
        return {"refus": True, "name": name}
    return {"name": name, "role": role, "auditor": bool(groups & AUDITORS), "type": "salarié"}


def auth_prestataire(login, password):
    """Prestataire : annuaire OpenLDAP dédié, chiffré, compte verrouillé en fin de mission."""
    if not PRESTA_SERVER:
        return None
    dn = f"uid={login},{PRESTA_BASE}"
    conn = Connection(Server(PRESTA_SERVER, port=636, use_ssl=True, tls=_tls(), connect_timeout=3),
                      user=dn, password=password, receive_timeout=5)
    try:
        if not conn.bind():
            return None
        conn.search(dn, "(objectClass=*)", attributes=["cn", "o"])
        name = f"{conn.entries[0].cn} ({conn.entries[0].o})" if conn.entries else login
    except Exception as exc:
        app.logger.warning("annuaire prestataires injoignable : %s", exc)
        return None
    finally:
        conn.unbind()
    return {"name": name, "role": "prestataire", "auditor": False, "type": "prestataire"}


def login_required(roles=None, api=False):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            if "user" not in session:
                return (jsonify(error="session expirée"), 401) if api else redirect(url_for("login"))
            if roles and session.get("role") not in roles:
                audit("refus", f"{request.method} {request.path}")
                return (jsonify(error="droits insuffisants"), 403) if api else abort(403)
            return fn(*a, **kw)
        return wrapper
    return deco


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        user = request.form.get("login", "").strip().lower()
        password = request.form.get("password", "")
        if not LOGIN_RE.match(user) or not password:      # mot de passe vide = connexion anonyme LDAP : refus
            error = "Identifiant ou mot de passe incorrect."
        else:
            info = auth_employee(user, password) or auth_prestataire(user, password)
            if info and not info.get("refus"):
                session.clear()
                session.permanent = True
                session.update(user=user, name=info["name"], role=info["role"],
                               auditor=info["auditor"], type=info["type"])
                audit("connexion", f"{info['type']} - droits : {info['role']}", user)
                return redirect(url_for("index"))
            if info and info.get("refus"):
                error = "Votre compte n'a pas accès à TrackR."
                audit("connexion_refusee", "aucun groupe TrackR", user)
            else:
                error = "Identifiant ou mot de passe incorrect."
                audit("connexion_echouee", "", user)
    return render_template("login.html", error=error, node=NODE)


@app.route("/logout")
def logout():
    if "user" in session:
        audit("deconnexion")
    session.clear()
    return redirect(url_for("login"))


# --------------------------------------------------------------- pages
@app.route("/")
@login_required()
def index():
    return render_template("index.html", node=NODE, late=LATE_MINUTES)


@app.route("/journal")
@login_required()
def journal():
    if not session.get("auditor"):
        audit("refus", "consultation du journal")
        abort(403)
    rows = query("SELECT at, username, action, detail, source_ip, node FROM audit_log ORDER BY id DESC LIMIT 200")
    return render_template("journal.html", rows=rows, node=NODE)


@app.errorhandler(403)
def forbidden(_e):
    return render_template("message.html", title="Accès refusé",
                           text="Vous n'avez pas les droits pour cette page. Ce refus a été enregistré.",
                           node=NODE), 403


# --------------------------------------------------------------- API
def _parse_time(value, field):
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        abort(400, f"{field} invalide")


@app.route("/api/events", methods=["GET"])
@login_required(api=True)
def list_events():
    day = request.args.get("date") or dt.date.today().isoformat()
    rows = query("""
        SELECT id, kind, plate, reference, quay, scheduled_at, actual_at, recorded_by, recorded_on,
               (scheduled_at IS NOT NULL AND actual_at > scheduled_at + %s * interval '1 minute') AS late
          FROM events WHERE actual_at::date = %s ORDER BY actual_at DESC""", (LATE_MINUTES, day))
    hide_people = session.get("role") == "prestataire"     # un prestataire ne voit pas qui a saisi
    for r in rows:
        r["id"] = str(r["id"])
        for k in ("scheduled_at", "actual_at"):
            r[k] = r[k].isoformat() if r[k] else None
        if hide_people:
            r["recorded_by"] = None
    summary = {
        "arrivees": sum(1 for r in rows if r["kind"] == "arrivee"),
        "departs": sum(1 for r in rows if r["kind"] == "depart"),
        "retards": sum(1 for r in rows if r["late"]),
    }
    return jsonify(node=NODE, events=rows, summary=summary)


@app.route("/api/events", methods=["POST"])
@login_required(roles={"ecriture"}, api=True)
def add_event():
    if request.headers.get("X-Requested-With") != "trackr":
        abort(400)
    data = request.get_json(force=True, silent=True) or {}
    try:
        event_id = uuid.UUID(str(data.get("id")))
    except ValueError:
        abort(400, "identifiant invalide")
    kind = data.get("kind")
    plate = (data.get("plate") or "").strip().upper()[:20]
    reference = (data.get("reference") or "").strip()[:40]
    if kind not in ("arrivee", "depart") or not plate or not reference:
        abort(400, "champs manquants")
    try:
        cur = db().cursor()
        cur.execute("""INSERT INTO events (id, kind, plate, reference, quay, scheduled_at, actual_at, recorded_by, recorded_on)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                    (str(event_id), kind, plate, reference, (data.get("quay") or "")[:10],
                     _parse_time(data.get("scheduled_at"), "heure prévue"),
                     _parse_time(data.get("actual_at"), "heure réelle") or dt.datetime.now(dt.timezone.utc),
                     session["user"], NODE))
        created = cur.rowcount == 1
    except psycopg2.errors.ReadOnlySqlTransaction:
        # serveur de secours pas encore promu : le poste garde la saisie et réessaie
        return jsonify(error="serveur en lecture seule, nouvel essai automatique"), 503
    if created:
        audit("saisie", f"{kind} {plate} {reference}")
    return jsonify(id=str(event_id), created=created, node=NODE), 201 if created else 200


# --------------------------------------------------------------- supervision
@app.route("/health")
def health():
    try:
        primary = is_primary()
    except psycopg2.Error as exc:
        return jsonify(status="erreur", node=NODE, error=str(exc).strip()), 503
    return jsonify(status="ok", node=NODE, db_role="primary" if primary else "standby")


@app.route("/metrics")
def metrics():
    lines = [f'trackr_up{{node="{NODE}"}} 1']
    try:
        primary = is_primary()
        lines.append(f"trackr_db_is_primary {int(primary)}")
        if primary:
            n = query("SELECT count(*) AS n FROM pg_stat_replication", one=True)["n"]
            lines.append(f"trackr_replicas_connected {n}")
        today = query("""SELECT
              count(*) FILTER (WHERE kind='arrivee') AS arrivees,
              count(*) FILTER (WHERE kind='depart') AS departs,
              count(*) FILTER (WHERE scheduled_at IS NOT NULL AND actual_at > scheduled_at + %s * interval '1 minute') AS retards
            FROM events WHERE actual_at::date = current_date""", (LATE_MINUTES,), one=True)
        for k, v in today.items():
            lines.append(f'trackr_events_today{{type="{k}"}} {v}')
    except psycopg2.Error:
        lines.append("trackr_db_up 0")
    else:
        lines.append("trackr_db_up 1")
    return Response("\n".join(lines) + "\n", mimetype="text/plain; version=0.0.4")
