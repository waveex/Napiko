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
      for (const surface of ['--oxy-page', '--oxy-surface', '--oxy-surface-raised']) {
        check('--oxy-text', surface, 4.5)
        check('--oxy-text-muted', surface, 4.5)
        check('--oxy-action-focus', surface, 3)
        check('--oxy-border-control', surface, 3)
      }
      for (const action of ['--oxy-action-base', '--oxy-action-hover', '--oxy-action-active']) {
        check('--oxy-action-contrast', action, 4.5)
      }
      check('--oxy-action-base', '--oxy-action-soft', 4.5)
    })
  }
}
