import { useEffect, useState } from 'react'
import { roleOf, ROOM_ID, type RoomLinks } from '../shared/room.ts'
import { Room } from './Room.tsx'

interface Route {
  roomId: string
  token: string
}

function parseHash(): Route | null {
  const params = new URLSearchParams(location.hash.slice(1))
  const roomId = params.get('sala') ?? ''
  const token = params.get('t') ?? ''
  return ROOM_ID.test(roomId) && roleOf(token) ? { roomId, token } : null
}

export function roomHash(roomId: string, token: string) {
  return `#sala=${encodeURIComponent(roomId)}&t=${encodeURIComponent(token)}`
}

export function App() {
  const [route, setRoute] = useState(parseHash)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route) return <Room key={`${route.roomId}:${route.token}`} {...route} />
  return <Home />
}

function Home() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/rooms', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const links = (await res.json()) as RoomLinks
      location.hash = roomHash(links.roomId, links.editor)
    } catch {
      setError('Não foi possível criar a sala. O servidor está no ar?')
      setBusy(false)
    }
  }

  return (
    <main className="home">
      <h1>Quadro Colaborativo</h1>
      <p>
        Desenhe com outras pessoas em tempo real. Cada um vê o cursor dos outros, o quadro funciona
        sem internet e tudo se reconcilia ao reconectar.
      </p>
      <button type="button" className="btn primary" onClick={create} disabled={busy}>
        {busy ? 'Criando…' : 'Criar sala'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
