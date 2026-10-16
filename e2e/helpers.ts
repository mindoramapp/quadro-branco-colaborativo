import { expect, type Browser, type Page } from '@playwright/test'

export async function newUser(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1100, height: 720 } })
  // Nome fixo para cada usuário (a presença mostra a inicial no avatar).
  await context.addInitScript((n) => {
    localStorage.setItem('quadro:usuario', JSON.stringify({ name: n, color: '#1971c2' }))
  }, name)
  return context.newPage()
}

export async function createRoom(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar sala' }).click()
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByTestId('status')).toContainText('Ao vivo')
  await page.getByRole('button', { name: 'Compartilhar' }).click()
  const editor = await page.getByTestId('link-editor').inputValue()
  const reader = await page.getByTestId('link-reader').inputValue()
  await page.keyboard.press('Escape')
  return { editor, reader }
}

export async function open(page: Page, url: string) {
  await page.goto(url)
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByTestId('status')).toContainText(/Ao vivo|Sem servidor/)
}

export function count(page: Page) {
  return page.getByTestId('board')
}

export async function drag(page: Page, tool: string, from: [number, number], to: [number, number]) {
  await page.getByRole('button', { name: tool, exact: true }).click()
  await page.mouse.move(...from)
  await page.mouse.down()
  await page.mouse.move(...to, { steps: 8 })
  await page.mouse.up()
}
