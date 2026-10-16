import { useState } from 'react'
import type { Board } from '../shared/board.ts'
import type { ConnectionStatus } from './sync/connection.ts'
import type { Peer } from './sync/Cursors.tsx'
import type { User } from './sync/user.ts'

interface Props {
  board: Board
  roomId: string
  token: string
  readOnly: boolean
  status: ConnectionStatus
  user: User
  peers: Peer[]
  onUser: (u: User) => void
}

function statusLabel(s: ConnectionStatus): { text: string; tone: 'ok' | 'warn' | 'off' } {
  const serverDown = !s.online || s.server === 'disconnected'
  // Canal WebRTC já aberto sobrevive à queda do servidor: o quadro segue ao vivo entre os pares.
  if (serverDown && s.peers > 0) return { text: `Sem servidor · ${s.peers} P2P`, tone: 'warn' }
  if (serverDown) return { text: 'Offline: as mudanças ficam salvas aqui', tone: 'off' }
  if (s.server === 'connecting') return { text: 'Conectando…', tone: 'warn' }
  return { text: s.peers > 0 ? `Ao vivo · ${s.peers} P2P` : 'Ao vivo', tone: 'ok' }
}

export function TopBar({ status, user, peers, onUser }: Props) {
  const [editing, setEditing] = useState(false)
  const label = statusLabel(status)
  return (
    <div className="topbar">
      <span className={`status ${label.tone}`} data-testid="status" role="status">
        <i />
        {label.text}
      </span>
      <ul className="people" aria-label="Pessoas na sala" data-testid="people">
        <li title={`${user.name} (você)`}>
          {editing ? (
            <input
              aria-label="Seu nome"
              autoFocus
              maxLength={24}
              defaultValue={user.name}
              onBlur={(e) => {
                const name = e.target.value.trim()
                if (name) onUser({ ...user, name })
                setEditing(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button
              type="button"
              className="avatar me"
              style={{ background: user.color }}
              onClick={() => setEditing(true)}
              aria-label={`Você: ${user.name}. Clique para trocar o nome`}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </button>
          )}
        </li>
        {peers.map((p) => (
          <li key={p.clientId} title={p.user.name}>
            <span className="avatar" style={{ background: p.user.color }}>
              {p.user.name.slice(0, 1).toUpperCase()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
