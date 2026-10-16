import { expect, test } from '@playwright/test'
import { count, createRoom, drag, newUser, open } from './helpers.ts'

test('três pessoas: editores desenham juntos, leitor só acompanha', async ({ browser }) => {
  const ana = await newUser(browser, 'Ana')
  const bruno = await newUser(browser, 'Bruno')
  const carla = await newUser(browser, 'Carla')
  const links = await createRoom(ana)
  await open(bruno, links.editor)
  await open(carla, links.reader)

  await drag(ana, 'Retângulo', [120, 160], [320, 300])
  await drag(bruno, 'Elipse', [450, 160], [650, 320])
  for (const p of [ana, bruno, carla]) await expect(count(p)).toHaveAttribute('data-count', '2')

  // Presença: cada um vê os outros dois, e o cursor de quem se mexe.
  await ana.mouse.move(700, 500, { steps: 4 })
  await expect(bruno.locator('.people li')).toHaveCount(3)
  await expect(bruno.getByTestId('remote-cursor').first()).toBeVisible()

  // Leitor: sem ferramentas e, mesmo arrastando no quadro, nada muda para ninguém.
  await expect(carla.getByTestId('readonly')).toBeVisible()
  await carla.mouse.move(200, 450)
  await carla.mouse.down()
  await carla.mouse.move(400, 600, { steps: 5 })
  await carla.mouse.up()
  await ana.waitForTimeout(500)
  await expect(count(ana)).toHaveAttribute('data-count', '2')

  // Desfazer é por usuário: o Ctrl+Z do Bruno remove só a elipse dele.
  await bruno.keyboard.press('Control+z')
  for (const p of [ana, bruno, carla]) await expect(count(p)).toHaveAttribute('data-count', '1')
  await bruno.keyboard.press('Control+Shift+z')
  await expect(count(ana)).toHaveAttribute('data-count', '2')
})

test('edição offline fica guardada e sobe ao reconectar', async ({ browser }) => {
  const ana = await newUser(browser, 'Ana')
  const links = await createRoom(ana)

  await ana.context().setOffline(true)
  await expect(ana.getByTestId('status')).toContainText('Offline')
  await drag(ana, 'Seta', [150, 200], [400, 260])
  await expect(count(ana)).toHaveAttribute('data-count', '1')

  // Recarregar offline não perde nada (IndexedDB).
  await ana.context().setOffline(false)
  await ana.reload()
  await expect(count(ana)).toHaveAttribute('data-count', '1')
  await expect(ana.getByTestId('status')).toContainText('Ao vivo')

  // Quem entra depois recebe a seta que foi feita sem internet.
  const bruno = await newUser(browser, 'Bruno')
  await open(bruno, links.reader)
  await expect(count(bruno)).toHaveAttribute('data-count', '1')
})

test('salvar versão, restaurar e exportar SVG', async ({ browser }) => {
  const ana = await newUser(browser, 'Ana')
  await createRoom(ana)
  await drag(ana, 'Retângulo', [120, 160], [320, 300])

  await ana.getByRole('button', { name: 'Versões' }).click()
  await ana.getByLabel('Nome da versão').fill('Primeira ideia')
  await ana.getByRole('button', { name: 'Salvar versão' }).click()
  await expect(ana.getByTestId('versions')).toContainText('Primeira ideia')
  await ana.keyboard.press('Escape')

  await drag(ana, 'Elipse', [450, 160], [650, 320])
  await expect(count(ana)).toHaveAttribute('data-count', '2')
  await ana.getByRole('button', { name: 'Versões' }).click()
  await ana.getByRole('button', { name: 'Restaurar' }).click()
  await expect(count(ana)).toHaveAttribute('data-count', '1')

  await ana.getByRole('button', { name: 'Exportar' }).click()
  const [file] = await Promise.all([
    ana.waitForEvent('download'),
    ana.getByRole('button', { name: 'SVG', exact: true }).click(),
  ])
  expect(file.suggestedFilename()).toMatch(/^quadro-.*\.svg$/)
})
