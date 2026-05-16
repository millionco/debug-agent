import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { CookieDatabaseCopyError, CookieReadError } from "./errors";

const IS_BUN = "Bun" in globalThis;
const BUN_SQLITE_MODULE = "bun:sqlite";
const NODE_SQLITE_MODULE = "node:sqlite";

interface SqliteDatabase {
  prepare(sql: string): { all(): Record<string, unknown>[] };
  close(): void;
}

export type SqliteEngine = "bun" | "node" | "libsql";

const openDatabase = async (
  engine: SqliteEngine,
  databasePath: string,
): Promise<SqliteDatabase> => {
  if (engine === "bun") {
    const { Database } = await import(BUN_SQLITE_MODULE);
    return new Database(databasePath, { readonly: true }) as SqliteDatabase;
  }
  if (engine === "node") {
    const { DatabaseSync } = await import(NODE_SQLITE_MODULE);
    return new DatabaseSync(databasePath, {
      readOnly: true,
      readBigInts: true,
    }) as unknown as SqliteDatabase;
  }
  const { default: LibsqlDatabase } = await import("libsql");
  return new LibsqlDatabase(databasePath, { readonly: true }) as unknown as SqliteDatabase;
};

const defaultEngine: SqliteEngine = IS_BUN ? "bun" : "node";

export interface CopyToTempResult {
  readonly tempDir: string;
  readonly tempDatabasePath: string;
  /** Removes the temp directory. Always call when finished. */
  cleanup(): Promise<void>;
}

export class SqliteClient {
  constructor(private readonly engine: SqliteEngine = defaultEngine) {}

  async query(
    databasePath: string,
    sql: string,
    browser: string,
  ): Promise<Record<string, unknown>[]> {
    let database: SqliteDatabase;
    try {
      database = await openDatabase(this.engine, databasePath);
    } catch (cause) {
      throw new CookieReadError(browser, String(cause));
    }
    try {
      return database.prepare(sql).all();
    } catch (cause) {
      throw new CookieReadError(browser, String(cause));
    } finally {
      try {
        database.close();
      } catch {}
    }
  }

  async copyToTemp(
    databasePath: string,
    prefix: string,
    filename: string,
    browser: string,
  ): Promise<CopyToTempResult> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const tempDatabasePath = path.join(tempDir, filename);

    try {
      await fs.copyFile(databasePath, tempDatabasePath);
    } catch (cause) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw new CookieDatabaseCopyError(browser, databasePath, String(cause));
    }

    await fs.copyFile(`${databasePath}-wal`, `${tempDatabasePath}-wal`).catch(() => {});
    await fs.copyFile(`${databasePath}-shm`, `${tempDatabasePath}-shm`).catch(() => {});

    return {
      tempDir,
      tempDatabasePath,
      cleanup: async () => {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      },
    };
  }
}
