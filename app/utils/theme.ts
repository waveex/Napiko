import type { ThemeContext } from '~/types/theme'

export function resolveThemeContext(value: unknown): ThemeContext {
  return value === 'customer' ? 'customer' : 'workshop'
}
