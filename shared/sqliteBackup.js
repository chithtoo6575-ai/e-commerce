import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// VACUUM INTO creates a consistent SQLite snapshot, including committed WAL data.
// Let failures propagate: a migration must never proceed without its backup.
export function backupSqliteDatabase(database, databaseFile) {
  const backupDir = path.join(path.dirname(databaseFile), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(
    backupDir,
    `${path.basename(databaseFile)}.${stamp}.${crypto.randomUUID()}.bak`,
  );
  database.prepare("VACUUM INTO ?").run(backupFile);
  fs.chmodSync(backupFile, 0o600);
  return backupFile;
}

export function backupBeforePendingMigrations(
  database,
  databaseFile,
  versions,
) {
  const hasMigrations = database
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .get();
  const applied = hasMigrations
    ? database
        .prepare("SELECT version FROM schema_migrations")
        .all()
        .map((row) => row.version)
    : [];
  if (versions.every((version) => applied.includes(version))) return null;
  return backupSqliteDatabase(database, databaseFile);
}
