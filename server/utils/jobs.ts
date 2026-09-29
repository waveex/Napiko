/**
 * Obsługa zadań w tle. Nowe typy zadań (SMS, KSeF, przypomnienia) dopisuje się tutaj.
 */
import type { H3Event } from 'h3'
import { processJobs, type JobHandler } from '../db/jobs'
import { notificationJobHandlers } from '../db/notification-jobs'
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
    // Powiadomienia: push do zespołu, wiadomości do klienta, wygaśnięcie prośby o akceptację
    ...notificationJobHandlers({
      db: useDb(),
      push: usePush(),
      sendSms: sms => useSms().send(sms),
      sendEmail: email => useMailer().send(email),
    }),
  }
}

/**
 * Przetwarza zaległe zadania w limicie czasu. Wywoływane zaraz po żądaniach, które dodają zadania
 * (np. rejestracja → e-mail weryfikacyjny), oraz cyklicznie przez funkcję Netlify.
 */
export function runPendingJobs(options: { budgetMs?: number, batchSize?: number } = {}) {
  return processJobs(useDb(), handlers(), { budgetMs: options.budgetMs ?? 4000, batchSize: options.batchSize })
}

/**
 * Powiadomienia (push, e-mail, SMS) wychodzą zaraz po zmianie, której dotyczą – w granicach krótkiego budżetu czasu.
 * Na platformie, która pozwala dokończyć pracę po odpowiedzi (waitUntil), odpowiedź nie czeka na wysyłkę.
 * Czego nie zdążymy wysłać, wyśle funkcja cykliczna (co 5 min) – zadania są już w kolejce, w tej samej transakcji co zmiana.
 */
export async function deliverNotifications(event?: H3Event) {
  // małe partie: odpowiedź nie czeka na długą kolejkę zaległości
  const run = runPendingJobs({ budgetMs: 2500, batchSize: 4 }).catch((error) => {
    console.error('[jobs]', error)
  })
  if (event?.context.waitUntil) {
    event.waitUntil(run)
    return
  }
  await run
}
