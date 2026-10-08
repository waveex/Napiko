import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolveThemeContext } from '../../app/utils/theme.ts'

test('public customer context is explicit, absent or invalid context stays workshop', () => {
  assert.equal(resolveThemeContext('customer'), 'customer')
  for (const value of [undefined, null, 'workshop', 'dark', '/app/customers']) {
    assert.equal(resolveThemeContext(value), 'workshop')
  }
})

// Read actual CSS tokens, so a palette edit cannot silently regress contrast.
const primitives = readFileSync('app/assets/css/theme/primitives.css', 'utf8')
const semantic = readFileSync('app/assets/css/theme/semantic.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
function declarations(css: string) {
  return Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()]))
}
function palette(customer: boolean, dark: boolean) {
  const values = declarations(primitives)
  for (const rule of semantic.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const matches = rule[1]!.split(',').some(selector =>
      (!selector.includes('customer') || customer) && (!selector.includes('.dark') || dark),
    )
    if (matches) Object.assign(values, declarations(rule[2]!))
  }
  function resolve(key: string): string {
    const value = values[key]!
    assert.ok(value, `Missing token ${key}`)
    const alias = value.match(/^var\((--[\w-]+)\)$/)
    return alias ? resolve(alias[1]!) : value
  }
  return resolve
}
function luminance(hex: string) {
  const full = hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex
  const rgb = [1, 3, 5].map((offset) => {
    const c = Number.parseInt(full.slice(offset, offset + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722
}
function contrast(a: string, b: string) {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
for (const customer of [false, true]) {
  for (const dark of [false, true]) {
    test(`contrast: ${customer ? 'customer' : 'workshop'} / ${dark ? 'dark' : 'light'}`, () => {
      const token = palette(customer, dark)
      const check = (a: string, b: string, minimum: number) => {
        const ratio = contrast(token(a), token(b))
        assert.ok(ratio >= minimum, `${a} on ${b}: ${ratio.toFixed(2)} < ${minimum}`)
      }
      for (const surface of ['--napiko-page', '--napiko-surface', '--napiko-surface-raised']) {
        check('--napiko-text', surface, 4.5)
        check('--napiko-text-muted', surface, 4.5)
        check('--napiko-action-focus', surface, 3)
        check('--napiko-border-control', surface, 3)
      }
      for (const action of ['--napiko-action-base', '--napiko-action-hover', '--napiko-action-active']) {
        check('--napiko-action-contrast', action, 4.5)
      }
      check('--napiko-action-base', '--napiko-action-soft', 4.5)
    })
  }
}

// Kotwice z pakietu marki (palette.json): zmiana odcienia musi być świadoma, bo te kolory są częścią identyfikacji.
const anchors = {
  'workshop/light': [false, false, {
    '--napiko-brand-base': '#e84924', '--napiko-action-base': '#bd3619', '--napiko-action-hover': '#a52e15', '--napiko-action-active': '#8b2713',
    '--napiko-action-soft': '#fcebe5', '--napiko-page': '#f3f1eb', '--napiko-surface': '#ffffff', '--napiko-text': '#202326',
    '--napiko-text-muted': '#62605c', '--napiko-border-control': '#817a70',
  }],
  'customer/light': [true, false, {
    '--napiko-brand-base': '#68418c', '--napiko-action-base': '#68418c', '--napiko-action-hover': '#573574', '--napiko-action-active': '#46295f',
    '--napiko-action-soft': '#efe7f5', '--napiko-page': '#f7f4fa', '--napiko-surface': '#ffffff', '--napiko-text': '#292330',
    '--napiko-text-muted': '#716477', '--napiko-border-control': '#8d7d96',
  }],
  'workshop/dark': [false, true, {
    '--napiko-brand-base': '#e84924', '--napiko-action-base': '#ff936d', '--napiko-action-contrast': '#202326', '--napiko-page': '#181a1d',
    '--napiko-surface': '#24272b', '--napiko-text': '#f3f1eb', '--napiko-text-muted': '#c3beb6', '--napiko-border-control': '#8c8984',
  }],
  'customer/dark': [true, true, {
    '--napiko-brand-base': '#b99acc', '--napiko-action-base': '#c6a5df', '--napiko-action-contrast': '#241b2b', '--napiko-page': '#211a28',
    '--napiko-surface': '#2d2434', '--napiko-text': '#f7f4fa', '--napiko-text-muted': '#c8b7d2', '--napiko-border-control': '#96839f',
  }],
} as const
for (const [name, [customer, dark, expected]] of Object.entries(anchors)) {
  test(`brand anchors: ${name}`, () => {
    const token = palette(customer, dark)
    for (const [key, hex] of Object.entries(expected)) {
      const value = token(key).toLowerCase()
      assert.equal(value.length === 4 ? '#' + [...value.slice(1)].map(c => c + c).join('') : value, hex, key)
    }
  })
}

test('every colour scale is complete and gets darker towards 950', () => {
  const token = palette(false, false)
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
  for (const scale of ['orange', 'violet', 'graphite', 'plum']) {
    const values = steps.map(step => token(`--color-napiko-${scale}-${step}`))
    const luminances = values.map(luminance)
    luminances.forEach((value, index) => {
      if (index) assert.ok(value < luminances[index - 1]!, `${scale}-${steps[index]} (${values[index]}) must be darker than ${scale}-${steps[index - 1]}`)
    })
  }
})

test('Nuxt UI primary and neutral scales follow the context, in both brightness modes', () => {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
  for (const [customer, primary, neutral] of [[false, 'orange', 'graphite'], [true, 'violet', 'plum']] as const) {
    for (const dark of [false, true]) {
      const token = palette(customer, dark)
      for (const step of steps) {
        assert.equal(token(`--color-napiko-primary-${step}`), token(`--color-napiko-${primary}-${step}`))
        assert.equal(token(`--color-napiko-neutral-${step}`), token(`--color-napiko-${neutral}-${step}`))
      }
    }
  }
})
