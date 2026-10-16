// Cena "site" do Reel: dois usuários-robô desenham um fluxo e deixam o cursor na tela.
// Uso: npm run dev (em outro terminal) → node video/robos-demo.mjs → copie .build/link.txt
// para o campo url da cena site em reel.config.json e rode o gerador em ../_video.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync(new URL('.build/', import.meta.url), { recursive: true })
const BASE = 'http://localhost:5173'
const links = await (await fetch(BASE + '/api/rooms', { method: 'POST' })).json()
const ed = BASE + '/#sala=' + links.roomId + '&t=' + encodeURIComponent(links.editor)
const b = await chromium.launch({ channel: 'chrome' })
const mk = async (name, color) => {
  const c = await b.newContext({ viewport: { width: 412, height: 860 } })
  await c.addInitScript(
    ([n, col]) => localStorage.setItem('quadro:usuario', JSON.stringify({ name: n, color: col })),
    [name, color],
  )
  const p = await c.newPage()
  await p.goto(ed)
  await p.getByTestId('board').waitFor()
  return p
}
const ana = await mk('Ana', '#e03131'),
  bruno = await mk('Bruno', '#1971c2')
await ana.waitForTimeout(1500)
const tool = (p, name) => p.getByRole('button', { name, exact: true }).click()
const color = (p, c) => p.getByRole('button', { name: 'Cor ' + c }).click()
const drag = async (p, a, z) => {
  await p.mouse.move(...a)
  await p.mouse.down()
  await p.mouse.move(...z, { steps: 10 })
  await p.mouse.up()
}
const text = async (p, at, t) => {
  await tool(p, 'Texto')
  await p.mouse.click(...at)
  await p.keyboard.type(t)
  await p.keyboard.press('Enter')
}
await color(ana, '#e03131')
await tool(ana, 'Retângulo')
await drag(ana, [40, 200], [230, 290])
await text(ana, [62, 232], 'Ideia')
await tool(ana, 'Seta')
await drag(ana, [135, 300], [135, 390])
await color(bruno, '#1971c2')
await tool(bruno, 'Elipse')
await drag(bruno, [30, 400], [250, 500])
await text(bruno, [80, 436], 'Proposta')
await tool(bruno, 'Seta')
await drag(bruno, [140, 510], [140, 590])
await color(ana, '#2f9e44')
await tool(ana, 'Retângulo')
await drag(ana, [40, 600], [240, 690])
await text(ana, [58, 630], 'Cliente ✓')
await color(bruno, '#f08c00')
await tool(bruno, 'Caneta')
await bruno.mouse.move(280, 640)
await bruno.mouse.down()
for (const [x, y] of [
  [300, 600],
  [330, 590],
  [360, 610],
  [370, 650],
  [345, 690],
  [300, 700],
  [280, 670],
  [285, 640],
])
  await bruno.mouse.move(x, y, { steps: 6 })
await bruno.mouse.up()
await color(bruno, '#1971c2')
await text(bruno, [270, 720], 'Fechado!')
await ana.mouse.move(250, 330, { steps: 5 })
await bruno.mouse.move(320, 470, { steps: 5 })
writeFileSync(new URL('.build/link.txt', import.meta.url), ed)
console.log('pronto', await ana.getByTestId('board').getAttribute('data-count'))
// mexe os cursores de leve até ser encerrado
const end = Date.now() + 8 * 60_000
while (Date.now() < end) {
  await ana.mouse.move(250 + Math.random() * 6, 330 + Math.random() * 6)
  await bruno.mouse.move(320 + Math.random() * 6, 470 + Math.random() * 6)
  await ana.waitForTimeout(5000)
}
await b.close()
