/**
 * Sesja pobierana względnym adresem, dzięki czemu podczas renderowania na serwerze
 * Nuxt przekazuje ciasteczka użytkownika (adres bezwzględny klienta Better Auth ich nie dostaje).
 */
export function useAuthSession() {
  return useFetch<typeof authClient.$Infer.Session | null>('/api/auth/get-session', {
    key: 'auth-session',
    dedupe: 'defer',
  })
}
