/**
 * Pulpit: sekcje policzone na serwerze według uprawnień roli (server/api/dashboard.get.ts).
 * Sekcja, do której rola nie ma dostępu, przychodzi jako null.
 */
export function useDashboard(options: { immediate?: boolean } = {}) {
  return useFetch('/api/dashboard', { key: 'dashboard', immediate: options.immediate ?? true })
}

export type DashboardData = NonNullable<ReturnType<typeof useDashboard>['data']['value']>
export type DashboardMine = NonNullable<DashboardData['mine']>
export type DashboardOffice = NonNullable<DashboardData['office']>
export type DashboardTeam = NonNullable<DashboardData['team']>
export type DashboardReport = NonNullable<DashboardData['report']>
export type DashboardSetup = NonNullable<DashboardData['setup']>
