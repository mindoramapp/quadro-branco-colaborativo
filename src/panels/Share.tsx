import { useEffect, useState } from 'react'
import type { RoomLinks } from '../../shared/room.ts'
import { roomHash } from '../App.tsx'

interface Props {
  roomId: string
  token: string
  readOnly: boolean
}

function linkFor(roomId: string, token: string) {
  return `${location.origin}${location.pathname}${roomHash(roomId, token)}`
}

function CopyField({ label, value, testId }: { label: string; value: string; testId: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <label className="field">
      <span>{label}</span>
      <div className="row">
        <input readOnly value={value} data-testid={testId} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </label>
  )
}

export function SharePanel({ roomId, token, readOnly }: Props) {
  const [links, setLinks] = useState<RoomLinks | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (readOnly) return
    fetch(`/api/rooms/${roomId}/links?t=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? (r.json() as Promise<RoomLinks>) : Promise.reject(new Error())))
      .then(setLinks)
      .catch(() => setError('Sem conexão com o servidor: só o seu link está disponível.'))
  }, [roomId, token, readOnly])

  return (
    <div className="panel" role="dialog" aria-label="Compartilhar sala">
      <h2>Compartilhar</h2>
      {links ? (
        <>
          <CopyField
            label="Pode editar"
            value={linkFor(roomId, links.editor)}
            testId="link-editor"
          />
          <CopyField
            label="Só pode ver"
            value={linkFor(roomId, links.reader)}
            testId="link-reader"
          />
        </>
      ) : (
        <CopyField
          label={readOnly ? 'Link de leitura' : 'Seu link'}
          value={linkFor(roomId, token)}
          testId="link-own"
        />
      )}
      {error && <p className="hint">{error}</p>}
      <p className="hint">
        Quem tem o link de leitura vê tudo ao vivo, mas o servidor recusa qualquer alteração vinda
        dele.
      </p>
    </div>
  )
}
