import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { BRAND_COLORS, BRAND_ICON_VERSION, brandIcon, brandLogoFiles } from '../../shared/brand.ts'

const pngSize = (path: string) => {
  const file = readFileSync(path)
  assert.equal(file.subarray(1, 4).toString(), 'PNG', `${path} is not a PNG`)
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) }
}

test('logo files exist for every context, variant and brightness', () => {
  for (const context of ['workshop', 'customer'] as const) {
    for (const variant of ['full', 'mark'] as const) {
      for (const file of Object.values(brandLogoFiles(variant, context))) {
        assert.ok(existsSync(`public${file}`), `${file} is missing`)
      }
    }
  }
})

test('app icons have the sizes their names promise (rerun `pnpm brand:build` after changing the SVG sources)', () => {
  const expected = {
    'icon-192': 192, 'icon-512': 512, 'icon-maskable-512': 512, 'apple-touch-icon': 180,
    'customer-192': 192, 'customer-512': 512, 'customer-maskable-512': 512, 'customer-apple-touch-icon': 180,
    'favicon-32': 32, 'badge-96': 96,
  }
  for (const [name, size] of Object.entries(expected)) {
    assert.deepEqual(pngSize(`public/icons/${name}.png`), { width: size, height: size }, name)
  }
})

test('static manifest, service worker and shared constants agree on colours and icon version', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
  assert.equal(manifest.theme_color, BRAND_COLORS.workshop.themeColor)
  assert.equal(manifest.background_color, BRAND_COLORS.workshop.background)
  for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((shortcut: { icons: unknown[] }) => shortcut.icons)] as { src: string }[]) {
    assert.ok(icon.src.endsWith(`?v=${BRAND_ICON_VERSION}`), icon.src)
    assert.ok(existsSync(`public${icon.src.split('?')[0]}`), `${icon.src} is missing`)
  }
  const worker = readFileSync('public/sw.js', 'utf8')
  for (const name of ['customer-192', 'icon-192', 'badge-96']) {
    assert.ok(worker.includes(brandIcon(name)), `sw.js should use ${brandIcon(name)}`)
  }
})

test('browser and splash colours match the interface palette', () => {
  const primitives = readFileSync('app/assets/css/theme/primitives.css', 'utf8')
  const hex = (name: string) => primitives.match(new RegExp(`--color-napiko-${name}: (#[0-9a-f]{6})`, 'i'))![1]!.toUpperCase()
  assert.equal(BRAND_COLORS.workshop.background, hex('graphite-50'))
  assert.equal(BRAND_COLORS.workshop.themeColor, hex('graphite-900'))
  assert.equal(BRAND_COLORS.workshop.themeColorDark, hex('graphite-950'))
  assert.equal(BRAND_COLORS.customer.background, hex('plum-50'))
  assert.equal(BRAND_COLORS.customer.themeColor, hex('violet-600'))
  assert.equal(BRAND_COLORS.customer.themeColorDark, hex('plum-950'))
  // e-maile: te same role kolorów co w interfejsie
  assert.equal(BRAND_COLORS.workshop.text, hex('graphite-900'))
  assert.equal(BRAND_COLORS.workshop.muted, hex('graphite-600'))
  assert.equal(BRAND_COLORS.workshop.action, hex('orange-600'))
  assert.equal(BRAND_COLORS.workshop.border, hex('graphite-200'))
  assert.equal(BRAND_COLORS.customer.text, hex('plum-900'))
  assert.equal(BRAND_COLORS.customer.muted, hex('plum-600'))
  assert.equal(BRAND_COLORS.customer.action, hex('violet-600'))
  assert.equal(BRAND_COLORS.customer.border, hex('plum-200'))
})
