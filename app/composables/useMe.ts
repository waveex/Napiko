/** Dane zalogowanego użytkownika i aktywnej organizacji (współdzielone między stronami). */
export function useMe() {
  return useFetch('/api/me', { key: 'me', dedupe: 'defer' })
}

/** Przełącza aktywną organizację i przeładowuje aplikację (wszystkie dane zależą od organizacji). */
export async function switchOrganization(organizationId: string, path = '/app') {
  await authClient.organization.setActive({ organizationId })
  reloadNuxtApp({ path })
}
