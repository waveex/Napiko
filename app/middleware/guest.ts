/** Strony tylko dla niezalogowanych (logowanie, rejestracja). */
export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await useAuthSession()
  if (session.value) {
    const redirect = typeof to.query.redirect === 'string' && to.query.redirect.startsWith('/') && !to.query.redirect.startsWith('//')
      ? to.query.redirect
      : '/app'
    return navigateTo(redirect)
  }
})
