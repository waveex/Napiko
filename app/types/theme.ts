export type ThemeContext = 'workshop' | 'customer'

declare module '#app' {
  interface PageMeta {
    themeContext?: ThemeContext
  }
}
