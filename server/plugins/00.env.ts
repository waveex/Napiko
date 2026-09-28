/**
 * Na podglądach wdrożeń Netlify (deploy preview) funkcje nie znają swojego adresu w czasie działania.
 * Uzupełniamy BETTER_AUTH_URL adresem zapisanym podczas budowania, zanim cokolwiek odczyta konfigurację.
 */
export default defineNitroPlugin(() => {
  const { buildAppUrl } = useRuntimeConfig()
  if (!process.env.BETTER_AUTH_URL && buildAppUrl) {
    process.env.BETTER_AUTH_URL = buildAppUrl
  }
})
