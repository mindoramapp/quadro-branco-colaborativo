import type { WebSocket } from 'ws'

// Servidor de sinalização no protocolo do y-webrtc (subscribe / unsubscribe / publish / ping).
// Ele só repassa ofertas, respostas e candidatos ICE entre pares do mesmo tópico; o conteúdo
// do quadro trafega direto entre os navegadores. Cada conexão já chega autenticada para um
// único tópico (a sala do token de editor), e qualquer outro tópico é recusado.

type Message =
  | { type: 'subscribe' | 'unsubscribe'; topics?: unknown[] }
  | { type: 'publish'; topic?: unknown; [k: string]: unknown }
  | { type: 'ping' }

const PING_INTERVAL_MS = 30_000

export class Signaling {
  private topics = new Map<string, Set<WebSocket>>()

  connect(ws: WebSocket, allowedTopic: string) {
    const subscribed = new Set<string>()
    let alive = true
    const ping = setInterval(() => {
      if (!alive) {
        ws.terminate()
        return
      }
      alive = false
      ws.ping()
    }, PING_INTERVAL_MS)
    ws.on('pong', () => (alive = true))

    ws.on('message', (raw) => {
      let msg: Message
      try {
        msg = JSON.parse(String(raw)) as Message
      } catch {
        return
      }
      switch (msg.type) {
        case 'subscribe':
          for (const t of msg.topics ?? []) {
            if (t !== allowedTopic) continue
            let subs = this.topics.get(t)
            if (!subs) this.topics.set(t, (subs = new Set()))
            subs.add(ws)
            subscribed.add(t)
          }
          break
        case 'unsubscribe':
          for (const t of msg.topics ?? []) {
            if (typeof t === 'string') this.leave(ws, t, subscribed)
          }
          break
        case 'publish': {
          if (msg.topic !== allowedTopic) break
          const receivers = this.topics.get(msg.topic)
          if (!receivers) break
          const out = JSON.stringify({ ...msg, clients: receivers.size })
          for (const r of receivers) if (r.readyState === r.OPEN) r.send(out)
          break
        }
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }))
          break
      }
    })

    ws.on('close', () => {
      clearInterval(ping)
      for (const t of [...subscribed]) this.leave(ws, t, subscribed)
    })
  }

  private leave(ws: WebSocket, topic: string, subscribed: Set<string>) {
    const subs = this.topics.get(topic)
    subs?.delete(ws)
    if (subs?.size === 0) this.topics.delete(topic)
    subscribed.delete(topic)
  }

  peers(topic: string): number {
    return this.topics.get(topic)?.size ?? 0
  }
}
