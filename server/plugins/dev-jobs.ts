/**
 * Lokalnie (pnpm dev) kolejkę przetwarza pętla co 5 s – zastępuje funkcję cykliczną Netlify.
 */
export default defineNitroPlugin((nitroApp) => {
  if (!import.meta.dev) return
  const timer = setInterval(() => {
    runPendingJobs({ budgetMs: 3000 }).catch(error => console.error('[jobs]', error))
  }, 5000)
  nitroApp.hooks.hook('close', () => clearInterval(timer))
})
