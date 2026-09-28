/**
 * Obsługa zadań w tle. Nowe typy zadań (SMS, KSeF, przypomnienia) dopisuje się tutaj.
 */
import { processJobs, type JobHandler } from '../db/jobs'
import type { OutgoingEmail } from '../lib/mail-types'
import type { OutgoingSms } from '../lib/sms'

function handlers(): Record<string, JobHandler> {
  return {
    'email.send': async (job) => {
      await useMailer().send(job.payload as unknown as OutgoingEmail)
    },
    'sms.send': async (job) => {
      await useSms().send(job.payload as unknown as OutgoingSms)
    },
    'file.delete': async (job) => {
      const key = String(job.payload.storageKey ?? '')
      if (!key.startsWith('org/')) throw new Error('Nieprawidłowy klucz pliku')
      await useFileStorage().remove(key)
    },
  }
}

/**
 * Przetwarza zaległe zadania w limicie czasu. Wywoływane zaraz po żądaniach, które dodają zadania
 * (np. rejestracja → e-mail weryfikacyjny), oraz cyklicznie przez funkcję Netlify.
 */
export function runPendingJobs(options: { budgetMs?: number } = {}) {
  return processJobs(useDb(), handlers(), { budgetMs: options.budgetMs ?? 4000 })
}
