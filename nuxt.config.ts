// https://nuxt.com/docs/api/configuration/nuxt-config
import { TASK_STATUS_ICON, VEHICLE_TYPE_INFO } from './shared/workshop'
import { TEAM_NOTIFICATIONS } from './shared/notifications'

/** Ikony wybierane w kodzie dynamicznie (rodzaje pojazdów, statusy zadań, typy powiadomień) – skaner ich nie widzi. */
const dynamicIcons = [
  ...Object.values(VEHICLE_TYPE_INFO).map(info => info.icon),
  ...Object.values(TASK_STATUS_ICON),
  ...Object.values(TEAM_NOTIFICATIONS).map(info => info.icon),
].map(name => name.replace(/^i-lucide-/, 'lucide:'))

export default defineNuxtConfig({

  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/i18n'],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'pl' },
      title: 'Napiko',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Napiko – komunikacja i organizacja pracy warsztatów z klientem.' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  colorMode: { preference: 'light', fallback: 'light' },

  runtimeConfig: {
    // Netlify udostępnia adres podglądu (DEPLOY_PRIME_URL) tylko podczas budowania, dlatego zapisujemy go w buildzie.
    buildAppUrl: process.env.CONTEXT && process.env.CONTEXT !== 'production' ? (process.env.DEPLOY_PRIME_URL ?? '') : '',
    public: {
      appName: 'Napiko',
      // NUXT_PUBLIC_APP_URL – publiczny adres aplikacji (potrzebny m.in. aplikacji mobilnej)
      appUrl: '',
    },
  },

  // Nagłówki bezpieczeństwa dla wszystkich odpowiedzi (CSP dojdzie razem z modułami biznesowymi)
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
      },
    },
    '/api/**': { cache: false },
    // Strona akceptacji: token w adresie nie może wyciec w nagłówku Referer ani trafić do wyszukiwarek
    '/approve/**': {
      headers: {
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      },
    },
    // Strona statusu naprawy dla klienta: jak strona akceptacji
    '/s/**': {
      headers: {
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      },
    },
    // Service worker powiadomień push: przeglądarka zawsze sprawdza nową wersję
    '/sw.js': {
      headers: { 'Cache-Control': 'no-cache', 'Content-Type': 'text/javascript; charset=utf-8' },
    },
  },
  compatibilityDate: '2026-09-26',

  // Serwer działa na Node ≥ 22; domyślny cel Nitro (es2019) nie zna literałów BigInt (shared/workshop.ts)
  nitro: {
    esbuild: { options: { target: 'es2022' } },
  },

  typescript: {
    strict: true,
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  i18n: {
    defaultLocale: 'pl',
    strategy: 'no_prefix',
    locales: [
      { code: 'pl', language: 'pl-PL', name: 'Polski', file: 'pl.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'napiko_locale',
      redirectOn: 'root',
    },
  },

  // Ikony w paczce aplikacji (działają bez serwera, np. w aplikacji mobilnej)
  icon: {
    clientBundle: {
      scan: true,
      icons: [...new Set(dynamicIcons)],
    },
  },
})
