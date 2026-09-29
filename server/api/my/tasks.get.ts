/**
 * „Moje zadania” – ekran mechanika: zadania przypisane do mnie (także podzadania zadań, które mam),
 * mój uruchomiony licznik, czas pracy i zgłoszone potrzeby; w trybie „sami biorą” także zadania do wzięcia.
 * Zapytania są w server/utils/my-tasks.ts – korzysta z nich też pulpit, więc obie strony pokazują te same liczby.
 */
import { withTenant } from '../../db/tenant'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { task: ['read'] })
  return withTenant(useDb(), ctx, tx => loadMyTasks(tx, ctx))
})
