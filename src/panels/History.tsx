import { useEffect, useState } from 'react'
import { elementsFromUpdate, type Board } from '../../shared/board.ts'
import type { SnapshotInfo } from '../../shared/room.ts'

interface Props {
  board: Board
  roomId: string
  token: string
  author: string
}

export function HistoryPanel({ board, roomId, token, author }: Props) {
  const [list, setList] = useState<SnapshotInfo[] | null>(null)
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const base = `/api/rooms/${roomId}/snapshots`
  const t = `t=${encodeURIComponent(token)}`

  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    fetch(`${base}?${t}`)
      .then((res) =>
        res.ok ? (res.json() as Promise<SnapshotInfo[]>) : Promise.reject(new Error()),
      )
      .then((data) => alive && setList(data))
      .catch(() => alive && setMessage('O histórico precisa do servidor (sem conexão agora).'))
    return () => {
      alive = false
    }
  }, [base, t, reload])

  const save = async () => {
    setMessage('')
    const res = await fetch(`${base}?${t}`, {
      method: 'POST',
      body: JSON.stringify({ label, author }),
    }).catch(() => null)
    if (!res?.ok) {
      setMessage('Não foi possível salvar a versão.')
      return
    }
    setLabel('')
    setMessage('Versão salva.')
    setReload((n) => n + 1)
  }

  const restore = async (snap: SnapshotInfo) => {
    const res = await fetch(`${base}/${snap.id}?${t}`).catch(() => null)
    if (!res?.ok) {
      setMessage('Não foi possível baixar a versão.')
      return
    }
    board.replaceAll(elementsFromUpdate(new Uint8Array(await res.arrayBuffer())))
    setMessage(`Restaurada: “${snap.label}”. Ctrl+Z desfaz a restauração.`)
  }

  return (
    <div className="panel" role="dialog" aria-label="Histórico de versões">
      <h2>Versões</h2>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <input
          aria-label="Nome da versão"
          placeholder="Nome da versão (opcional)"
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="btn primary">
          Salvar versão
        </button>
      </form>
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
      <ul className="versions" data-testid="versions">
        {list?.length === 0 && <li className="hint">Nenhuma versão salva ainda.</li>}
        {list?.map((s) => (
          <li key={s.id}>
            <div>
              <strong>{s.label}</strong>
              <small>
                {new Date(s.createdAt).toLocaleString('pt-BR')} · {s.author} · {s.elements}{' '}
                {s.elements === 1 ? 'elemento' : 'elementos'}
              </small>
            </div>
            <button type="button" className="btn" onClick={() => void restore(s)}>
              Restaurar
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
