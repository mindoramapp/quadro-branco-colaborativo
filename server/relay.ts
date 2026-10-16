import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import type { WebSocket } from 'ws'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as Y from 'yjs'
import type { Role } from '../shared/room.ts'
import type { Store } from './store.ts'

// Relay compatível com o protocolo do y-websocket (mensagens sync = 0, awareness = 1).
// Diferente do servidor de exemplo, ele aplica o papel do token: de um leitor só aceita
// o pedido de sincronização (step 1) e a presença; updates do documento são descartados.

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
const SAVE_DEBOUNCE_MS = 1000

interface Conn {
  ws: WebSocket
  role: Role
  /** Ids de awareness que chegaram por esta conexão (para limpar quando ela cai). */
  clients: Set<number>
}

export class Room {
  readonly id: string
  readonly doc = new Y.Doc()
  readonly awareness: awarenessProtocol.Awareness
  readonly conns = new Map<WebSocket, Conn>()
  private saveTimer: NodeJS.Timeout | null = null
  private store: Store

  constructor(id: string, store: Store) {
    this.id = id
    this.store = store
    const saved = store.loadDoc(id)
    if (saved) Y.applyUpdate(this.doc, saved)
    this.awareness = new awarenessProtocol.Awareness(this.doc)
    this.awareness.setLocalState(null)

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      const enc = encoding.createEncoder()
      encoding.writeVarUint(enc, MESSAGE_SYNC)
      syncProtocol.writeUpdate(enc, update)
      const msg = encoding.toUint8Array(enc)
      for (const conn of this.conns.values()) if (conn.ws !== origin) send(conn.ws, msg)
      this.scheduleSave()
    })

    this.awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const conn = this.conns.get(origin as WebSocket)
        if (conn) {
          for (const id of added) conn.clients.add(id)
          for (const id of removed) conn.clients.delete(id)
        }
        const changed = [...added, ...updated, ...removed]
        const enc = encoding.createEncoder()
        encoding.writeVarUint(enc, MESSAGE_AWARENESS)
        encoding.writeVarUint8Array(
          enc,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed),
        )
        const msg = encoding.toUint8Array(enc)
        for (const c of this.conns.values()) send(c.ws, msg)
      },
    )
  }

  join(ws: WebSocket, role: Role) {
    const conn: Conn = { ws, role, clients: new Set() }
    this.conns.set(ws, conn)
    ws.binaryType = 'arraybuffer'
    ws.on('message', (data: ArrayBuffer) => this.onMessage(conn, new Uint8Array(data)))
    ws.on('close', () => this.leave(conn))

    // Começa a sincronização: envia o nosso step 1 e a presença atual.
    const enc = encoding.createEncoder()
    encoding.writeVarUint(enc, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(enc, this.doc)
    send(ws, encoding.toUint8Array(enc))
    const states = [...this.awareness.getStates().keys()]
    if (states.length > 0) {
      const aw = encoding.createEncoder()
      encoding.writeVarUint(aw, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        aw,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, states),
      )
      send(ws, encoding.toUint8Array(aw))
    }
  }

  private onMessage(conn: Conn, data: Uint8Array) {
    try {
      const dec = decoding.createDecoder(data)
      const type = decoding.readVarUint(dec)
      if (type === MESSAGE_SYNC) {
        const enc = encoding.createEncoder()
        encoding.writeVarUint(enc, MESSAGE_SYNC)
        const sub = decoding.readVarUint(dec)
        if (sub === syncProtocol.messageYjsSyncStep1) {
          syncProtocol.readSyncStep1(dec, enc, this.doc)
        } else if (conn.role === 'editor') {
          if (sub === syncProtocol.messageYjsSyncStep2) {
            syncProtocol.readSyncStep2(dec, this.doc, conn.ws)
          } else if (sub === syncProtocol.messageYjsUpdate) {
            syncProtocol.readUpdate(dec, this.doc, conn.ws)
          }
        }
        // Leitor: step 2 / update ignorados em silêncio.
        if (encoding.length(enc) > 1) send(conn.ws, encoding.toUint8Array(enc))
      } else if (type === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(dec),
          conn.ws,
        )
      }
    } catch (err) {
      console.warn(`[relay] mensagem inválida na sala ${this.id}:`, (err as Error).message)
    }
  }

  private leave(conn: Conn) {
    this.conns.delete(conn.ws)
    awarenessProtocol.removeAwarenessStates(this.awareness, [...conn.clients], null)
  }

  private scheduleSave() {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.save()
    }, SAVE_DEBOUNCE_MS)
  }

  save() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.store.saveDoc(this.id, Y.encodeStateAsUpdate(this.doc))
  }

  destroy() {
    this.save()
    this.awareness.destroy()
    this.doc.destroy()
  }
}

function send(ws: WebSocket, msg: Uint8Array) {
  if (ws.readyState !== ws.OPEN) return
  ws.send(msg, (err) => {
    if (err) ws.close()
  })
}

export class Rooms {
  private rooms = new Map<string, Room>()
  private store: Store

  constructor(store: Store) {
    this.store = store
  }

  get(id: string): Room {
    let room = this.rooms.get(id)
    if (!room) {
      room = new Room(id, this.store)
      this.rooms.set(id, room)
    }
    return room
  }

  connect(id: string, ws: WebSocket, role: Role) {
    const room = this.get(id)
    room.join(ws, role)
    ws.on('close', () => {
      // Sala vazia: grava e libera a memória.
      if (room.conns.size === 0 && this.rooms.get(id) === room) {
        room.destroy()
        this.rooms.delete(id)
      }
    })
  }

  /** Estado atual da sala (da memória, se aberta; senão, do banco). */
  state(id: string): Uint8Array {
    const room = this.rooms.get(id)
    if (room) return Y.encodeStateAsUpdate(room.doc)
    return this.store.loadDoc(id) ?? Y.encodeStateAsUpdate(new Y.Doc())
  }

  closeAll() {
    for (const room of this.rooms.values()) room.destroy()
    this.rooms.clear()
  }
}
