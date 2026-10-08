/**
 * Stałe identyfikacji wizualnej współdzielone przez aplikację, serwer (manifest) i testy.
 * Kolory interfejsu są w app/assets/css/theme/, pliki graficzne w public/brand/ i public/icons/
 * (rastry generuje `pnpm brand:build` ze źródeł SVG).
 */
export type BrandContext = 'workshop' | 'customer'
export type BrandVariant = 'full' | 'mark'

/**
 * Wartości poza interfejsem, gdzie nie ma zmiennych CSS: pasek przeglądarki i ekran startowy PWA oraz e-maile
 * (warsztat = biuro i mechanik, klient). Zgodność z paletą interfejsu pilnuje tests/ui/brand.spec.ts.
 */
export const BRAND_COLORS = {
  workshop: { themeColor: '#202326', themeColorDark: '#181A1D', background: '#F3F1EB', text: '#202326', muted: '#62605C', action: '#BD3619', border: '#DCD8CE' },
  customer: { themeColor: '#68418C', themeColorDark: '#211A28', background: '#F7F4FA', text: '#292330', muted: '#716477', action: '#68418C', border: '#DFD6E8' },
} as const

/**
 * Wersja adresów ikon (parametr `?v=`). Podnosić po każdej zmianie grafik w public/icons/ – bez tego
 * przeglądarki i zainstalowane aplikacje mogą długo pokazywać starą ikonę. Pliki static (manifest, sw.js) mają ją wpisaną ręcznie.
 */
export const BRAND_ICON_VERSION = '2'

export function brandIcon(name: string) {
  return `/icons/${name}.png?v=${BRAND_ICON_VERSION}`
}

/** Wymiary logo w px (proporcje 1232:240 dla pełnego logo, kwadrat dla samego znaku). */
export const BRAND_LOGO_SIZE: Record<BrandVariant, { width: number, height: number }> = {
  full: { width: 185, height: 36 },
  mark: { width: 36, height: 36 },
}

/** Pliki SVG z public/brand/ na jasne i na ciemne tło; kontekst klienta ma fioletowy znak (jasny na ciemnym tle). */
export function brandLogoFiles(variant: BrandVariant, context: BrandContext) {
  if (variant === 'full') {
    return { light: `/brand/napiko-logo-${context}.svg`, dark: `/brand/napiko-logo-${context}-dark.svg` }
  }
  return {
    light: `/brand/napiko-mark-${context}.svg`,
    dark: context === 'customer' ? '/brand/napiko-mark-customer-dark.svg' : '/brand/napiko-mark-workshop.svg',
  }
}
