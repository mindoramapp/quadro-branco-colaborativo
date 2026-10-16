import { useEffect, useMemo, useState } from 'react'
import { roleOf } from '../shared/room.ts'
import { connectRoom, type Connection, type ConnectionStatus } from './sync/connection.ts'
import { Cursors, usePeers } from './sync/Cursors.tsx'
import { loadUser, saveUser, type User } from './sync/user.ts'
import { TopBar } from './TopBar.tsx'
import { Whiteboard } from './Whiteboard.tsx'

interface Props {
  roomId: string
  token: string
}

export function Room({ roomId, token }: Props) {
  const role = roleOf(token) ?? 'reader'
  const [user, setUser] = useState<User>(loadUser)
  const [conn, setConn] = useState<Connection | null>(null)

  useEffect(() => {
    // A conexão (sockets, WebRTC, IndexedDB) é um recurso externo criado a cada montagem;
    // o efeito é o lugar certo para abri-la e fechá-la, inclusive no StrictMode.
    const c = connectRoom(roomId, token, role, loadUser())
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConn(c)
    return () => {
      setConn(null)
      c.destroy()
    }
  }, [roomId, token, role])

  if (!conn) return <p className="loading">Conectando…</p>
  return (
    <RoomView
      conn={conn}
      roomId={roomId}
      token={token}
      readOnly={role === 'reader'}
      user={user}
      onUser={(u) => {
        setUser(u)
        saveUser(u)
        conn.setUser(u)
      }}
    />
  )
}

interface ViewProps {
  conn: Connection
  roomId: string
  token: string
  readOnly: boolean
  user: User
  onUser: (u: User) => void
}

function RoomView({ conn, roomId, token, readOnly, user, onUser }: ViewProps) {
  const [status, setStatus] = useState<ConnectionStatus>(conn.status)
  const peers = usePeers(conn.awareness)
  useEffect(() => conn.subscribe(setStatus), [conn])
  const author = useMemo(() => user.name, [user.name])

  return (
    <>
      <Whiteboard
        board={conn.board}
        readOnly={readOnly}
        author={author}
        onPointer={conn.setCursor}
      />
      <Cursors peers={peers} />
      <TopBar
        board={conn.board}
        roomId={roomId}
        token={token}
        readOnly={readOnly}
        status={status}
        user={user}
        peers={peers}
        onUser={onUser}
      />
    </>
  )
}
