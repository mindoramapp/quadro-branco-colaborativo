export interface User {
  name: string
  color: string
}

const COLORS = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#0c8599', '#c2255c']
const NAMES = [
  'Arara',
  'Baleia',
  'Capivara',
  'Golfinho',
  'Jabuti',
  'Lontra',
  'Tucano',
  'Peixe-boi',
  'Tartaruga',
  'Garoupa',
  'Mico',
  'Onça',
  'Siri',
  'Tamanduá',
  'Beija-flor',
  'Arraia',
]

const KEY = 'quadro:usuario'

export function loadUser(): User {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as User | null
    if (saved?.name && saved.color) return saved
  } catch {
    // armazenamento indisponível ou corrompido: gera outro
  }
  const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)] as T
  const user = { name: pick(NAMES), color: pick(COLORS) }
  saveUser(user)
  return user
}

export function saveUser(user: User) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user))
  } catch {
    // modo privado: segue só na memória
  }
}
