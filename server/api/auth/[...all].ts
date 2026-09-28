/**
 * Wszystkie endpointy logowania (Better Auth): rejestracja, logowanie, organizacje, zaproszenia…
 */
export default defineEventHandler(async (event) => {
  const response = await useAuth().handler(toWebRequest(event))
  if (event.method === 'POST') {
    // E-maile dodane do kolejki w tym żądaniu (weryfikacja, zaproszenie) wysyłamy od razu.
    // W funkcjach serverless nie ma pewnej pracy „po odpowiedzi”, dlatego czekamy (z limitem czasu).
    await runPendingJobs({ budgetMs: 4000 }).catch((error) => {
      console.error('[jobs] przetwarzanie po żądaniu nie powiodło się', error)
    })
  }
  return response
})
