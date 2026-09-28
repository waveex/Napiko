const dateFormats = {
  short: { year: 'numeric', month: '2-digit', day: '2-digit' },
  long: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  time: { hour: '2-digit', minute: '2-digit' },
} as const

const numberFormats = {
  // Rozliczenia warsztatu w złotych (kolejne waluty dojdą z rynkami UE)
  currency: { style: 'currency', currency: 'PLN' },
  integer: { maximumFractionDigits: 0 },
} as const

export default defineI18nConfig(() => ({
  fallbackLocale: 'pl',
  datetimeFormats: {
    pl: dateFormats,
    en: dateFormats,
  },
  numberFormats: {
    pl: numberFormats,
    en: numberFormats,
  },
}))
