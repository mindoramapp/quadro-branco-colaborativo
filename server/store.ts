import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Persistência em SQLite (node:sqlite, sem dependência nativa para compilar).
// docs: estado atual de cada sala (para quem entra depois de todos saírem).
// snapshots: versões nomeadas, gravadas a pedido de um editor.

export interface SnapshotRow {
  id: number
  label: string
  author: string
  createdAt: string
  elements: number
}

export class Store {
  private db: DatabaseSync

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS docs (
        room TEXT PRIMARY KEY,
        state BLOB NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        label TEXT NOT NULL,
        author TEXT NOT NULL,
        elements INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        state BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS snapshots_room ON snapshots (room, id);
    `)
  }

  loadDoc(room: string): Uint8Array | null {
    const row = this.db.prepare('SELECT state FROM docs WHERE room = ?').get(room) as
      { state: Uint8Array } | undefined
    return row?.state ?? null
  }

  saveDoc(room: string, state: Uint8Array) {
    this.db
      .prepare(
        `INSERT INTO docs (room, state, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (room) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
      )
      .run(room, state, new Date().toISOString())
  }

  addSnapshot(room: string, label: string, author: string, elements: number, state: Uint8Array) {
    const r = this.db
      .prepare(
        'INSERT INTO snapshots (room, label, author, elements, created_at, state) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(room, label, author, elements, new Date().toISOString(), state)
    return Number(r.lastInsertRowid)
  }

  listSnapshots(room: string): SnapshotRow[] {
    return this.db
      .prepare(
        `SELECT id, label, author, elements, created_at AS createdAt
         FROM snapshots WHERE room = ? ORDER BY id DESC LIMIT 100`,
      )
      .all(room) as unknown as SnapshotRow[]
  }

  getSnapshot(room: string, id: number): Uint8Array | null {
    const row = this.db
      .prepare('SELECT state FROM snapshots WHERE room = ? AND id = ?')
      .get(room, id) as { state: Uint8Array } | undefined
    return row?.state ?? null
  }

  close() {
    this.db.close()
  }
}
