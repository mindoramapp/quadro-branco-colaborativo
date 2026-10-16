import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { ROOM_ID, type Role, type RoomLinks } from '../shared/room.ts'

// Links sem estado: a sala não precisa existir no banco para o token ser válido.
// Quem tem o segredo do servidor assina "<sala>:<papel>"; o token é "<papel>.<assinatura>".

function sign(secret: string, roomId: string, role: Role): string {
  return createHmac('sha256', secret).update(`${roomId}:${role}`).digest('base64url').slice(0, 32)
}

export function makeToken(secret: string, roomId: string, role: Role): string {
  return `${role}.${sign(secret, roomId, role)}`
}

/** Papel concedido pelo token para esta sala, ou null se o token for inválido. */
export function verifyToken(secret: string, roomId: string, token: string | null): Role | null {
  if (!token || !ROOM_ID.test(roomId)) return null
  const [role, sig] = token.split('.')
  if ((role !== 'editor' && role !== 'reader') || !sig) return null
  const expected = Buffer.from(sign(secret, roomId, role))
  const given = Buffer.from(sig)
  return given.length === expected.length && timingSafeEqual(given, expected) ? role : null
}

export function newRoom(secret: string): RoomLinks {
  const roomId = randomBytes(9).toString('base64url')
  return {
    roomId,
    editor: makeToken(secret, roomId, 'editor'),
    reader: makeToken(secret, roomId, 'reader'),
  }
}
