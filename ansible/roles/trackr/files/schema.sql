-- Schéma TrackR. Exécuté par Ansible sur le serveur principal (idempotent).
-- L'application ne peut qu'AJOUTER : ni modification ni suppression.
CREATE TABLE IF NOT EXISTS events (
    id           uuid PRIMARY KEY,               -- créé sur le poste du quai : pas de doublon
    kind         text NOT NULL CHECK (kind IN ('arrivee', 'depart')),
    plate        text NOT NULL,
    reference    text NOT NULL,
    quay         text,
    scheduled_at timestamptz,
    actual_at    timestamptz NOT NULL,           -- heure réelle du clic, même hors ligne
    recorded_by  text NOT NULL,
    recorded_on  text NOT NULL,                  -- serveur qui a reçu la saisie
    received_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_actual_at ON events (actual_at);

CREATE TABLE IF NOT EXISTS audit_log (
    id        bigserial PRIMARY KEY,
    at        timestamptz NOT NULL DEFAULT now(),
    username  text,
    action    text NOT NULL,
    detail    text,
    source_ip text,
    node      text
);

GRANT CONNECT ON DATABASE trackr TO trackr;
GRANT USAGE ON SCHEMA public TO trackr;
GRANT SELECT, INSERT ON events, audit_log TO trackr;
GRANT USAGE ON SEQUENCE audit_log_id_seq TO trackr;
REVOKE UPDATE, DELETE, TRUNCATE ON events, audit_log FROM trackr;
GRANT pg_monitor TO trackr;
