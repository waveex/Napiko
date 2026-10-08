import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  CUSTOMER_STORY, CUSTOMER_STORY_ACTORS, storyRamp, WORKSHOP_STORY, WORKSHOP_STORY_ACTORS,
} from '../../app/utils/marketing-story.ts'

type Tree = { [key: string]: Tree | string }
const messages = {
  pl: JSON.parse(readFileSync('i18n/locales/pl/marketing.json', 'utf8')) as Tree,
  en: JSON.parse(readFileSync('i18n/locales/en/marketing.json', 'utf8')) as Tree,
}

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out[`${prefix}${key}`] = value
    else Object.assign(out, flatten(value, `${prefix}${key}.`))
  }
  return out
}
function node(tree: Tree, path: string): Tree | string | undefined {
  return path.split('.').filter(Boolean).reduce<Tree | string | undefined>((current, key) => (typeof current === 'object' ? current[key] : undefined), tree)
}
const flat = { pl: flatten(messages.pl), en: flatten(messages.en) }

/** Pliki, które renderują strony marketingowe. */
function sourceFiles() {
  const files = [
    'app/layouts/marketing.vue', 'app/pages/index.vue', 'app/pages/dla-warsztatow.vue', 'app/pages/dla-klientow.vue', 'app/pages/bezpieczenstwo.vue',
  ]
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name.endsWith('.vue')) files.push(path)
    }
  }
  walk('app/components/marketing')
  return files
}

test('polskie i angielskie teksty marketingowe mają te same klucze i żadnych pustych wartości', () => {
  assert.deepEqual(Object.keys(flat.pl).sort(), Object.keys(flat.en).sort())
  for (const lang of ['pl', 'en'] as const) {
    for (const [key, value] of Object.entries(flat[lang])) assert.ok(value.trim(), `${lang}: ${key} is empty`)
  }
})

test('każdy klucz użyty w stronach i komponentach marketingowych istnieje w obu językach', () => {
  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8')
    // klucze statyczne: t('marketing.x.y') / $t("marketing.x.y")
    for (const match of source.matchAll(/\bt\(\s*['"`](marketing\.[\w.]+)['"`]/g)) {
      for (const lang of ['pl', 'en'] as const) assert.ok(match[1]! in flat[lang], `${file}: missing ${lang} key ${match[1]}`)
    }
    // klucze z jednym wstawionym członem: `marketing.a.b.${key}.c` – każdy element listy musi mieć końcówkę `.c`
    for (const match of source.matchAll(/`(marketing\.[\w.]*)\$\{[^}]+\}([\w.]*)`/g)) {
      const [, prefix, suffix] = match
      for (const lang of ['pl', 'en'] as const) {
        const parent = node(messages[lang], prefix!.replace(/\.$/, ''))
        assert.ok(parent && typeof parent === 'object', `${file}: missing ${lang} group ${prefix}`)
        for (const [child, value] of Object.entries(parent)) {
          if (!suffix) continue
          assert.ok(node(typeof value === 'object' ? value : {}, suffix), `${file}: ${lang} ${prefix}${child}${suffix} is missing`)
        }
      }
    }
  }
})

for (const [name, steps, actors, page] of [
  ['warsztatu', WORKSHOP_STORY, WORKSHOP_STORY_ACTORS, 'workshops'],
  ['klienta', CUSTOMER_STORY, CUSTOMER_STORY_ACTORS, 'customers'],
] as const) {
  test(`historia ${name}: każdy krok ma tag, tytuł i tekst w obu językach, a aktor istnieje na torze`, () => {
    const keys = new Set(steps.map(step => step.key))
    assert.equal(keys.size, steps.length, 'duplicate step keys')
    const actorKeys = new Set<string>(actors.map(actor => actor.key))
    for (const step of steps) {
      assert.ok(actorKeys.has(step.actor), `${step.key}: unknown actor ${step.actor}`)
      assert.match(step.carry, /^i-lucide-/)
      for (const lang of ['pl', 'en'] as const) {
        for (const field of ['tag', 'title', 'text']) {
          assert.ok(flat[lang][`marketing.${page}.story.steps.${step.key}.${field}`], `${lang}: ${page} step ${step.key} lacks ${field}`)
        }
      }
    }
    // w tłumaczeniach nie ma kroków bez scenariusza
    for (const lang of ['pl', 'en'] as const) {
      const defined = Object.keys((node(messages[lang], `marketing.${page}.story.steps`) ?? {}) as Tree)
      assert.deepEqual(defined.sort(), [...keys].sort(), `${lang}: ${page} story steps differ from the scenario`)
      for (const actor of actors) assert.ok(flat[lang][`marketing.${page}.story.actors.${actor.key}`], `${lang}: actor ${actor.key}`)
    }
  })
}

test('strony marketingowe: tylko strona klienta wybiera paletę klienta, wszystkie używają układu marketing', () => {
  const pages = { 'index': false, 'dla-warsztatow': false, 'dla-klientow': true, 'bezpieczenstwo': false }
  for (const [page, customer] of Object.entries(pages)) {
    const source = readFileSync(`app/pages/${page}.vue`, 'utf8')
    assert.match(source, /layout: 'marketing'/, page)
    assert.equal(/themeContext: 'customer'/.test(source), customer, page)
  }
})

test('teksty marketingowe nie obiecują ceny ani gwarancji (cennik jest jeszcze ustalany)', () => {
  for (const lang of ['pl', 'en'] as const) {
    for (const [key, value] of Object.entries(flat[lang])) {
      if (key.startsWith('marketing.scene.')) continue
      assert.doesNotMatch(value, /bezpłatn|za darmo|\bfree\b|gwarantuj|guarantee|\d\s?(zł|PLN|EUR|USD)/i, `${lang}: ${key}`)
    }
  }
})

test('storyRamp rośnie monotonicznie od 0 do 1', () => {
  assert.equal(storyRamp(0, 0.2, 0.6), 0)
  assert.equal(storyRamp(1, 0.2, 0.6), 1)
  let previous = -1
  for (let i = 0; i <= 20; i++) {
    const value = storyRamp(i / 20, 0.2, 0.6)
    assert.ok(value >= previous)
    previous = value
  }
})
