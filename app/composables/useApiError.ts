/** Czytelny komunikat z błędu $fetch / Better Auth. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const e = error as { data?: { message?: string }, message?: string } | null
  return e?.data?.message || e?.message || fallback
}
