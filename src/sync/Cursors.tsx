import { useEffect, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import type { Presence } from './connection.ts'

export interface Peer extends Presence {
  clientId: number
}

/** Outros usuários presentes na sala (exclui este cliente). */
export function usePeers(awareness: Awareness): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([])
  useEffect(() => {
    const update = () => {
      const list: Peer[] = []
      awareness.getStates().forEach((state, clientId) => {
        const s = state as Partial<Presence>
        if (clientId !== awareness.clientID && s.user) {
          list.push({ clientId, user: s.user, cursor: s.cursor ?? null })
        }
      })
      setPeers(list)
    }
    update()
    awareness.on('change', update)
    return () => awareness.off('change', update)
  }, [awareness])
  return peers
}

export function Cursors({ peers }: { peers: Peer[] }) {
  return (
    <div className="cursors" aria-hidden="true">
      {peers.map((p) =>
        p.cursor ? (
          <div
            key={p.clientId}
            className="cursor"
            data-testid="remote-cursor"
            style={{ transform: `translate(${p.cursor.x}px, ${p.cursor.y}px)` }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M1 1l6 15 2-6 6-2z" fill={p.user.color} stroke="#fff" strokeWidth="1.5" />
            </svg>
            <span style={{ background: p.user.color }}>{p.user.name}</span>
          </div>
        ) : null,
      )}
    </div>
  )
}
