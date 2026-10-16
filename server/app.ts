import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { WebSocketServer } from 'ws'
import { elementsFromUpdate } from '../shared/board.ts'
import { ROOM_ID, webrtcRoom, type Role } from '../shared/room.ts'
import { Rooms } from './relay.ts'
import { Signaling } from './signaling.ts'
import { Store } from './store.ts'
import { newRoom, verifyToken, makeToken } from './tokens.ts'

export interface AppOptions {
  secret: string
  dbPath: string
  /** Pasta do build do Vite para servir em produção (opcional). */
  staticDir?: string
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage, limit = 4096): Promise<Record<string, unknown>> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new Error('corpo grande demais')
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return {}
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

const str = (v: unknown, max: number, fallback: string) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback

export function createApp(opts: AppOptions) {
  const store = new Store(opts.dbPath)
  const rooms = new Rooms(store)
  const signaling = new Signaling()
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 })
  const staticDir = opts.staticDir ? resolve(opts.staticDir) : null

  const auth = (roomId: string, url: URL): Role | null =>
    verifyToken(opts.secret, roomId, url.searchParams.get('t'))

  async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
    const parts = url.pathname.split('/').filter(Boolean) // ['api', 'rooms', id, ...]
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true })
    if (req.method === 'POST' && url.pathname === '/api/rooms') {
      return json(res, 201, newRoom(opts.secret))
    }
    const [, resource, roomId = '', sub, snapId] = parts
    if (resource !== 'rooms' || !ROOM_ID.test(roomId))
      return json(res, 404, { error: 'não encontrado' })
    const role = auth(roomId, url)
    if (!role) return json(res, 403, { error: 'link inválido para esta sala' })

    if (req.method === 'GET' && sub === 'links') {
      if (role !== 'editor') return json(res, 403, { error: 'só editores veem os links' })
      return json(res, 200, {
        roomId,
        editor: makeToken(opts.secret, roomId, 'editor'),
        reader: makeToken(opts.secret, roomId, 'reader'),
      })
    }
    if (sub === 'snapshots' && !snapId) {
      if (req.method === 'GET') return json(res, 200, store.listSnapshots(roomId))
      if (req.method === 'POST') {
        if (role !== 'editor') return json(res, 403, { error: 'leitores não criam versões' })
        const body = await readJson(req)
        const state = rooms.state(roomId)
        const count = elementsFromUpdate(state).length
        const label = str(body.label, 80, `Versão de ${new Date().toLocaleString('pt-BR')}`)
        const author = str(body.author, 40, 'anônimo')
        const id = store.addSnapshot(roomId, label, author, count, state)
        return json(res, 201, { id, label, author, elements: count })
      }
    }
    if (sub === 'snapshots' && snapId && req.method === 'GET') {
      const state = store.getSnapshot(roomId, Number(snapId))
      if (!state) return json(res, 404, { error: 'versão não encontrada' })
      res.writeHead(200, { 'content-type': 'application/octet-stream' })
      return res.end(state)
    }
    return json(res, 405, { error: 'método não suportado' })
  }

  function serveStatic(res: ServerResponse, pathname: string) {
    if (!staticDir) return json(res, 404, { error: 'não encontrado' })
    const target = normalize(join(staticDir, decodeURIComponent(pathname)))
    let file = target.startsWith(staticDir) && existsSync(target) ? target : ''
    if (!file || statSync(file).isDirectory()) file = join(staticDir, 'index.html')
    const type = MIME[extname(file)] ?? 'application/octet-stream'
    const immutable = file.includes(`${join(staticDir, 'assets')}`)
    res.writeHead(200, {
      'content-type': type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    createReadStream(file).pipe(res)
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      api(req, res, url).catch((err: Error) => json(res, 400, { error: err.message }))
      return
    }
    serveStatic(res, url.pathname)
  })

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const reject = (code: number, text: string) => {
      socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`)
      socket.destroy()
    }
    // /sync/<sala>?t=<token>  → relay y-websocket (editor e leitor)
    const sync = /^\/sync\/([^/]+)$/.exec(url.pathname)
    if (sync) {
      const roomId = sync[1] as string
      const role = auth(roomId, url)
      if (!role) return reject(403, 'Forbidden')
      wss.handleUpgrade(req, socket, head, (ws) => rooms.connect(roomId, ws, role))
      return
    }
    // /signal?room=<sala>&t=<token> → sinalização WebRTC (só editor entra na malha P2P)
    if (url.pathname === '/signal') {
      const roomId = url.searchParams.get('room') ?? ''
      if (auth(roomId, url) !== 'editor') return reject(403, 'Forbidden')
      wss.handleUpgrade(req, socket, head, (ws) => signaling.connect(ws, webrtcRoom(roomId)))
      return
    }
    reject(404, 'Not Found')
  })

  function close(): Promise<void> {
    for (const client of wss.clients) client.terminate()
    rooms.closeAll()
    return new Promise((done) =>
      server.close(() => {
        store.close()
        done()
      }),
    )
  }

  return { server, rooms, signaling, store, close }
}
