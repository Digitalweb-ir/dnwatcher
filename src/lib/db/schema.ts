import type { DatabaseSync } from 'node:sqlite'

/**
 * Migrations run in order and version is stored in `PRAGMA user_version`.
 * To change schema, never edit a previous migration — add a new one.
 */
const MIGRATIONS: string[] = [
  /* 1 — Base schema */
  `
  CREATE TABLE servers (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL,
    sub_url            TEXT    NOT NULL,
    check_interval_sec INTEGER NOT NULL DEFAULT 300,
    enabled            INTEGER NOT NULL DEFAULT 1,
    last_fetch_at      INTEGER,
    last_fetch_error   TEXT,
    created_at         INTEGER NOT NULL
  );

  CREATE TABLE configs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    fingerprint   TEXT    NOT NULL,
    uri           TEXT    NOT NULL,
    protocol      TEXT    NOT NULL,
    address       TEXT,
    port          INTEGER,
    label         TEXT,
    enabled       INTEGER NOT NULL DEFAULT 1,
    first_seen_at INTEGER NOT NULL,
    last_seen_at  INTEGER NOT NULL,

    -- وضعیت کش‌شده‌ی آخرین بررسی (برای سرعت داشبورد)
    status          TEXT    NOT NULL DEFAULT 'idle',
    fail_streak     INTEGER NOT NULL DEFAULT 0,
    last_ok         INTEGER,
    last_latency_ms INTEGER,
    last_check_at   INTEGER
  );
  CREATE UNIQUE INDEX idx_configs_server_fingerprint ON configs(server_id, fingerprint);
  CREATE INDEX idx_configs_server  ON configs(server_id);
  CREATE INDEX idx_configs_enabled ON configs(enabled, status);

  CREATE TABLE checks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id   INTEGER NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
    ts          INTEGER NOT NULL,
    ok          INTEGER NOT NULL,
    status      TEXT    NOT NULL,
    latency_ms  INTEGER,
    ttfb_ms     INTEGER,
    http_status INTEGER,
    error       TEXT
  );
  CREATE INDEX idx_checks_config_ts ON checks(config_id, ts);
  CREATE INDEX idx_checks_ts        ON checks(ts);

  CREATE TABLE incidents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id  INTEGER NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    fail_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
  CREATE INDEX idx_incidents_config ON incidents(config_id, started_at);
  CREATE INDEX idx_incidents_open   ON incidents(ended_at);

  CREATE TABLE daily_stats (
    config_id    INTEGER NOT NULL,
    day          TEXT    NOT NULL,
    total        INTEGER NOT NULL DEFAULT 0,
    up_count     INTEGER NOT NULL DEFAULT 0,
    avg_latency  REAL,
    min_latency  INTEGER,
    max_latency  INTEGER,
    p95_latency  INTEGER,
    downtime_sec INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (config_id, day)
  );

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE locks (
    name         TEXT PRIMARY KEY,
    holder       TEXT,
    heartbeat_at INTEGER NOT NULL
  );
  `,

  /* 2 — Add country to servers (server name + country) */
  `ALTER TABLE servers ADD COLUMN country TEXT;`,

  /* 3 — Change fingerprint to composite unique (server_id, fingerprint) for existing databases */
  `
  -- For existing databases with the old schema where fingerprint had a UNIQUE constraint
  -- SQLite creates an auto-index (sqlite_autoindex_configs_1) that cannot be dropped directly
  -- Solution: recreate the table with correct schema

  -- Create new table with correct schema
  CREATE TABLE IF NOT EXISTS configs_new (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    fingerprint   TEXT    NOT NULL,
    uri           TEXT    NOT NULL,
    protocol      TEXT    NOT NULL,
    address       TEXT,
    port          INTEGER,
    label         TEXT,
    enabled       INTEGER NOT NULL DEFAULT 1,
    first_seen_at INTEGER NOT NULL,
    last_seen_at  INTEGER NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'idle',
    fail_streak   INTEGER NOT NULL DEFAULT 0,
    last_ok       INTEGER,
    last_latency_ms INTEGER,
    last_check_at INTEGER
  );

  -- Create the composite unique index on new table
  CREATE UNIQUE INDEX IF NOT EXISTS idx_configs_server_fingerprint ON configs_new(server_id, fingerprint);
  CREATE INDEX IF NOT EXISTS idx_configs_server_new ON configs_new(server_id);
  CREATE INDEX IF NOT EXISTS idx_configs_enabled_new ON configs_new(enabled, status);

  -- Copy data from old table to new
  INSERT OR IGNORE INTO configs_new (id, server_id, fingerprint, uri, protocol, address, port, label, enabled, first_seen_at, last_seen_at, status, fail_streak, last_ok, last_latency_ms, last_check_at)
  SELECT id, server_id, fingerprint, uri, protocol, address, port, label, enabled, first_seen_at, last_seen_at, status, fail_streak, last_ok, last_latency_ms, last_check_at
  FROM configs
  WHERE NOT EXISTS (SELECT 1 FROM configs_new WHERE configs_new.id = configs.id);

  -- Drop old indexes
  DROP INDEX IF EXISTS idx_configs_server;
  DROP INDEX IF EXISTS idx_configs_enabled;

  -- Rename tables
  DROP TABLE IF EXISTS configs_old;
  ALTER TABLE configs RENAME TO configs_old;
  ALTER TABLE configs_new RENAME TO configs;
  `,

  /* 4 — Fix FK references for checks and incidents after configs rebuild */
  `
  PRAGMA foreign_keys = OFF;

  -- Recreate checks table
  CREATE TABLE checks_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id   INTEGER NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
    ts          INTEGER NOT NULL,
    ok          INTEGER NOT NULL,
    status      TEXT    NOT NULL,
    latency_ms  INTEGER,
    ttfb_ms     INTEGER,
    http_status INTEGER,
    error       TEXT
  );
  INSERT INTO checks_new SELECT * FROM checks;
  DROP TABLE checks;
  ALTER TABLE checks_new RENAME TO checks;
  CREATE INDEX idx_checks_config_ts ON checks(config_id, ts);
  CREATE INDEX idx_checks_ts        ON checks(ts);

  -- Recreate incidents table
  CREATE TABLE incidents_new (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id  INTEGER NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    fail_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
  INSERT INTO incidents_new SELECT * FROM incidents;
  DROP TABLE incidents;
  ALTER TABLE incidents_new RENAME TO incidents;
  CREATE INDEX idx_incidents_config ON incidents(config_id, started_at);
  CREATE INDEX idx_incidents_open   ON incidents(ended_at);

  PRAGMA foreign_keys = ON;
  `,
  `CREATE TABLE ssh_servers (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL,
    ip       TEXT    NOT NULL,
    user     TEXT    NOT NULL,
    password TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,
]

const SCHEMA_VERSION = MIGRATIONS.length

export function runMigrations(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined
  const current = Number(row?.user_version ?? 0)

  if (current > SCHEMA_VERSION) {
    throw new Error(
      `نسخه‌ی پایگاه‌داده (${current}) از نسخه‌ی برنامه (${SCHEMA_VERSION}) جدیدتر است.`,
    )
  }

  for (let version = current; version < SCHEMA_VERSION; version++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[version])
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

export { SCHEMA_VERSION }
