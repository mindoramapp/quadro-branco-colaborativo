import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import { Board } from '../../shared/board.ts'
import { webrtcRoom, type Role } from '../../shared/room.ts'
import type { User } from './user.ts'

// Três caminhos para o mesmo Y.Doc; o CRDT garante que a ordem de chegada não importa:
//  1. IndexedDB: cópia local, o quadro abre e funciona sem rede.
//  2. WebRTC (y-webrtc): editores trocam updates direto entre navegadores.
//  3. WebSocket (relay próprio): alternativa quando o P2P falha (NAT simétrico, firewall),
//     cópia no servidor para quem chega depois e canal único dos leitores.

export interface ConnectionStatus {
  server: 'connecting' | 'connected' | 'disconnected'
  peers: number
  online: boolean
  localReady: boolean
}

export interface Presence {
  user: User
  cursor: { x: number; y: number } | null
}

function iceServers(): RTCIceServer[] {
  try {
    const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined
    if (raw) return JSON.parse(raw) as RTCIceServer[]
  } catch {
    console.warn('VITE_ICE_SERVERS inválido; usando o STUN padrão')
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }]
}

export function connectRoom(roomId: string, token: string, role: Role, user: User) {
  const doc = new Y.Doc()
  const board = new Board(doc)
  const wsBase = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`

  const local = new IndexeddbPersistence(`quadro-${roomId}`, doc)
  const ws = new WebsocketProvider(`${wsBase}/sync`, roomId, doc, {
    params: { t: token },
    // Leitor não usa o BroadcastChannel: assim nenhuma alteração dele chega às outras abas.
    disableBc: role === 'reader',
  })
  const awareness = ws.awareness
  awareness.setLocalState({ user, cursor: null } satisfies Presence)

  const rtc =
    role === 'editor'
      ? new WebrtcProvider(webrtcRoom(roomId), doc, {
          signaling: [
            `${wsBase}/signal?room=${encodeURIComponent(roomId)}&t=${encodeURIComponent(token)}`,
          ],
          awareness,
          peerOpts: { config: { iceServers: iceServers() } },
        })
      : null

  const status: ConnectionStatus = {
    server: 'connecting',
    peers: 0,
    online: navigator.onLine,
    localReady: false,
  }
  const listeners = new Set<(s: ConnectionStatus) => void>()
  const emit = (patch: Partial<ConnectionStatus>) => {
    Object.assign(status, patch)
    const snapshot = { ...status }
    for (const fn of listeners) fn(snapshot)
  }

  ws.on('status', ({ status: s }: { status: ConnectionStatus['server'] }) => emit({ server: s }))
  rtc?.on('peers', ({ webrtcPeers }: { webrtcPeers: string[] }) =>
    emit({ peers: webrtcPeers.length }),
  )
  void local.whenSynced.then(() => emit({ localReady: true }))
  const onOnline = () => emit({ online: true })
  const onOffline = () => emit({ online: false })
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  let lastCursor = 0
  let pending: ReturnType<typeof setTimeout> | null = null
  /** Atualiza o cursor na presença, no máximo ~30 vezes por segundo. */
  const setCursor = (cursor: Presence['cursor']) => {
    const send = () => {
      lastCursor = Date.now()
      pending = null
      awareness.setLocalStateField('cursor', cursor)
    }
    if (pending) clearTimeout(pending)
    const wait = 33 - (Date.now() - lastCursor)
    if (wait <= 0 || cursor === null) send()
    else pending = setTimeout(send, wait)
  }

  const setUser = (u: User) => awareness.setLocalStateField('user', u)

  return {
    board,
    awareness,
    status: () => ({ ...status }),
    subscribe(fn: (s: ConnectionStatus) => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    setCursor,
    setUser,
    destroy() {
      if (pending) clearTimeout(pending)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      rtc?.destroy()
      ws.destroy()
      void local.destroy()
      board.destroy()
      doc.destroy()
    },
  }
}

export type Connection = ReturnType<typeof connectRoom>
