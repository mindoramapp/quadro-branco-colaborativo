import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import { Board } from '../shared/board.ts'
import type { RoomLinks } from '../shared/room.ts'
import { createApp } from '../server/app.ts'
import { makeToken, verifyToken } from '../server/tokens.ts'

const SECRET = 'segredo-de-teste'
const shape = { kind: 'rect' as const, color: '#000', width: 2, points: [0, 0, 10, 10] }

let app: ReturnType<typeof createApp>
let base: string
const providers: WebsocketProvider[] = []

beforeEach(async () => {
  app = createApp({ secret: SECRET, dbPath: ':memory:' })
  await new Promise<void>((ok) => app.server.listen(0, ok))
  base = `localhost:${(app.server.address() as AddressInfo).port}`
})

afterEach(async () => {
  for (const p of providers.splice(0)) p.destroy()
  await app.close()
})

async function createRoom(): Promise<RoomLinks> {
  const res = await fetch(`http://${base}/api/rooms`, { method: 'POST' })
  expect(res.status).toBe(201)
  return (await res.json()) as RoomLinks
}

function client(roomId: string, token: string) {
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(`ws://${base}/sync`, roomId, doc, {
    params: { t: token },
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    disableBc: true,
  })
  providers.push(provider)
  return { doc, board: new Board(doc), provider }
}

const synced = (p: WebsocketProvider) =>
  new Promise<void>((ok) => (p.synced ? ok() : p.once('sync', (s: boolean) => s && ok())))

async function until(check: () => boolean, ms = 3000) {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('tempo esgotado')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('tokens das salas', () => {
  it('valida papel e sala e recusa assinatura adulterada', () => {
    const t = makeToken(SECRET, 'sala123', 'reader')
    expect(verifyToken(SECRET, 'sala123', t)).toBe('reader')
    expect(verifyToken(SECRET, 'outra-sala', t)).toBeNull()
    expect(verifyToken(SECRET, 'sala123', t.replace('reader', 'editor'))).toBeNull()
    expect(verifyToken('outro-segredo', 'sala123', t)).toBeNull()
  })
})

describe('relay y-websocket', () => {
  it('dois editores convergem', async () => {
    const room = await createRoom()
    const a = client(room.roomId, room.editor)
    const b = client(room.roomId, room.editor)
    await Promise.all([synced(a.provider), synced(b.provider)])
    a.board.add({ ...shape, id: 'de-a' })
    b.board.add({ ...shape, id: 'de-b' })
    await until(() => a.board.list().length === 2 && b.board.list().length === 2)
    expect(a.board.list()).toEqual(b.board.list())
  })

  it('leitor recebe tudo, mas suas alterações são descartadas pelo servidor', async () => {
    const room = await createRoom()
    const editor = client(room.roomId, room.editor)
    const reader = client(room.roomId, room.reader)
    await Promise.all([synced(editor.provider), synced(reader.provider)])
    editor.board.add({ ...shape, id: 'do-editor' })
    await until(() => reader.board.get('do-editor') !== null)
    reader.board.add({ ...shape, id: 'do-leitor' })
    await new Promise((r) => setTimeout(r, 300))
    expect(editor.board.get('do-leitor')).toBeNull()
    const server = new Board(app.rooms.get(room.roomId).doc)
    expect(server.list().map((e) => e.id)).toEqual(['do-editor'])
  })

  it('recusa conexão com token inválido', async () => {
    const room = await createRoom()
    const ws = new WebSocket(`ws://${base}/sync/${room.roomId}?t=editor.falso`)
    const status = await new Promise<number>((ok) =>
      ws.on('unexpected-response', (_req, res) => ok(res.statusCode ?? 0)),
    )
    expect(status).toBe(403)
  })

  it('edições feitas offline se reconciliam ao reconectar', async () => {
    const room = await createRoom()
    const a = client(room.roomId, room.editor)
    const b = client(room.roomId, room.editor)
    await Promise.all([synced(a.provider), synced(b.provider)])
    const id = a.board.add({ ...shape, id: 'comum' })
    await until(() => b.board.get(id) !== null)

    a.provider.disconnect()
    a.board.update(id, { color: '#f00' }) // offline
    a.board.add({ ...shape, id: 'offline-a' })
    b.board.update(id, { points: [50, 50, 60, 60] }) // online, ao mesmo tempo
    a.provider.connect()

    await until(() => b.board.get('offline-a') !== null && a.board.get(id)?.points[0] === 50)
    expect(a.board.get(id)).toMatchObject({ color: '#f00', points: [50, 50, 60, 60] })
    expect(a.board.list()).toEqual(b.board.list())
  })

  it('a sala persiste depois que todos saem', async () => {
    const room = await createRoom()
    const a = client(room.roomId, room.editor)
    await synced(a.provider)
    a.board.add({ ...shape, id: 'guardado' })
    await until(() => app.rooms.get(room.roomId).doc.getMap('elements').has('guardado'))
    a.provider.destroy()
    await new Promise((r) => setTimeout(r, 100))
    const later = client(room.roomId, room.reader)
    await synced(later.provider)
    await until(() => later.board.get('guardado') !== null)
  })
})

describe('snapshots', () => {
  it('editor cria versão, leitor lista e baixa, mas não cria', async () => {
    const room = await createRoom()
    const a = client(room.roomId, room.editor)
    await synced(a.provider)
    a.board.add({ ...shape, id: 'v1' })
    await until(() => app.rooms.get(room.roomId).doc.getMap('elements').has('v1'))

    const api = (t: string, path = '', init?: RequestInit) =>
      fetch(`http://${base}/api/rooms/${room.roomId}/snapshots${path}?t=${t}`, init)
    const post = (t: string) =>
      api(t, '', { method: 'POST', body: JSON.stringify({ label: 'Primeira', author: 'Ana' }) })

    expect((await post(room.reader)).status).toBe(403)
    const created = (await (await post(room.editor)).json()) as { id: number; elements: number }
    expect(created.elements).toBe(1)

    const list = (await (await api(room.reader)).json()) as { label: string; author: string }[]
    expect(list).toMatchObject([{ label: 'Primeira', author: 'Ana' }])

    const bin = new Uint8Array(await (await api(room.reader, `/${created.id}`)).arrayBuffer())
    const doc = new Y.Doc()
    Y.applyUpdate(doc, bin)
    expect(new Board(doc).list().map((e) => e.id)).toEqual(['v1'])
  })

  it('links: só editor recupera o link de leitor', async () => {
    const room = await createRoom()
    const url = (t: string) => `http://${base}/api/rooms/${room.roomId}/links?t=${t}`
    expect((await fetch(url(room.reader))).status).toBe(403)
    expect(await (await fetch(url(room.editor))).json()).toEqual(room)
  })
})

describe('sinalização WebRTC', () => {
  const open = (url: string) =>
    new Promise<WebSocket>((ok, fail) => {
      const ws = new WebSocket(url)
      ws.on('open', () => ok(ws))
      ws.on('unexpected-response', (_req, res) => fail(new Error(String(res.statusCode))))
    })

  it('só editores entram e só no tópico da própria sala', async () => {
    const room = await createRoom()
    await expect(open(`ws://${base}/signal?room=${room.roomId}&t=${room.reader}`)).rejects.toThrow(
      '403',
    )
    const url = `ws://${base}/signal?room=${room.roomId}&t=${room.editor}`
    const [a, b] = await Promise.all([open(url), open(url)])
    const topic = `quadro-${room.roomId}`
    a.send(JSON.stringify({ type: 'subscribe', topics: [topic, 'quadro-outra'] }))
    b.send(JSON.stringify({ type: 'subscribe', topics: [topic] }))
    await until(() => app.signaling.peers(topic) === 2)
    expect(app.signaling.peers('quadro-outra')).toBe(0)

    const got = new Promise<Record<string, unknown>>((ok) =>
      b.on('message', (m) => ok(JSON.parse(String(m)) as Record<string, unknown>)),
    )
    a.send(JSON.stringify({ type: 'publish', topic, data: { oferta: 1 } }))
    expect(await got).toMatchObject({ type: 'publish', topic, clients: 2, data: { oferta: 1 } })
    a.close()
    b.close()
  })
})
