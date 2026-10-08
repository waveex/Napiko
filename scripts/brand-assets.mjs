/**
 * Eksport rastrów marki z wektorowych źródeł w public/brand/ (SVG są źródłem prawdy):
 *   pnpm brand:build
 *
 * Powstają ikony aplikacji i PWA (warsztat i klient), favicon, odznaka powiadomień oraz logo do e-maili.
 * Ikony „any” mają zaokrąglone rogi na przezroczystym tle; maskable i apple-touch-icon mają pełne tło,
 * bo maskę nakłada system (znak w źródłach mieści się w obszarze bezpiecznym maskable – koło o promieniu 40%).
 */
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const brand = join(root, 'public', 'brand')
const icons = join(root, 'public', 'icons')

const read = name => readFileSync(join(brand, name), 'utf8')

function render(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
}

/** Ikona „any”: to samo źródło przycięte do zaokrąglonego kwadratu, rogi przezroczyste. */
function rounded(svg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath><g clip-path="url(#r)">${svg}</g></svg>`
}

/** Szerszy viewBox = margines wokół znaku (odznaka powiadomień). */
function padded(svg, pad) {
  return svg.replace('viewBox="0 0 256 256"', `viewBox="${-pad} ${-pad} ${256 + 2 * pad} ${256 + 2 * pad}"`)
}

// Nazwy plików są niezmienione względem poprzedniej identyfikacji – starsze manifesty i service worker nadal je znajdą.
const appIcons = {
  workshop: { any192: 'icon-192', any512: 'icon-512', maskable: 'icon-maskable-512', apple: 'apple-touch-icon' },
  customer: { any192: 'customer-192', any512: 'customer-512', maskable: 'customer-maskable-512', apple: 'customer-apple-touch-icon' },
}

const files = []
for (const [context, names] of Object.entries(appIcons)) {
  const source = read(`napiko-app-${context}.svg`)
  files.push(
    [join(icons, `${names.any192}.png`), render(rounded(source), 192)],
    [join(icons, `${names.any512}.png`), render(rounded(source), 512)],
    [join(icons, `${names.maskable}.png`), render(source, 512)],
    [join(icons, `${names.apple}.png`), render(source, 180)],
  )
}

// Favicon: sam płaski znak. Odznaka: biała sylwetka na przezroczystym tle (system używa tylko kanału alfa).
files.push(
  [join(icons, 'favicon-32.png'), render(read('napiko-mark-workshop.svg'), 32)],
  [join(icons, 'badge-96.png'), render(padded(read('napiko-mark-white.svg'), 24), 96)],
)

// Logo do e-maili: 2× względem wyświetlania (160 px szerokości), tło przezroczyste.
files.push(
  [join(brand, 'napiko-logo-workshop-email.png'), render(read('napiko-logo-workshop.svg'), 320)],
  [join(brand, 'napiko-logo-customer-email.png'), render(read('napiko-logo-customer.svg'), 320)],
)

for (const [path, data] of files) {
  writeFileSync(path, data)
  console.log(`${path.slice(root.length + 1).replaceAll('\\', '/')}  ${data.length} B`)
}
