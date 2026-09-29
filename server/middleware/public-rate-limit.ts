/**
 * Limit żądań dla endpointów publicznych (/api/public/**: strona akceptacji i strona statusu naprawy).
 * Tokeny w linkach są nie do odgadnięcia (144–192 bity), ale endpointy bez logowania można zasypywać
 * żądaniami (koszt wywołań funkcji, wiersze w bazie). Limit Better Auth obejmuje tylko /api/auth/**.
 *
 * Klucz: adres IP + rodzaj żądania. Zmiany (POST) mają niski limit – klient wysyła je pojedynczo;
 * odczyty (GET) wyższy – strona statusu odświeża się co minutę, a klient może mieć kilka zleceń.
 */
const LIMITS = {
  write: { limit: 20, windowSeconds: 60 },
  read: { limit: 120, windowSeconds: 60 },
} as const

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/public/')) return
  if (process.env.NODE_ENV === 'test') return
  const kind = event.method === 'GET' || event.method === 'HEAD' ? 'read' : 'write'
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const { limit, windowSeconds } = LIMITS[kind]
  try {
    const result = await hitRateLimit(useDb(), `public:${kind}:${ip}`, limit, windowSeconds)
    if (!result.allowed) {
      setResponseHeader(event, 'Retry-After', result.retryAfterSeconds)
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: 'Zbyt wiele żądań. Spróbuj ponownie za chwilę.' })
    }
  }
  catch (error) {
    // Awaria licznika nie może wyłączyć stron klienta – przepuszczamy i logujemy
    if ((error as { statusCode?: number }).statusCode === 429) throw error
    console.error('[rate-limit]', error)
  }
})
