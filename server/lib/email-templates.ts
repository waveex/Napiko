/**
 * Szablony e-maili (PL). Proste HTML + tekst; wygląd dopracujemy razem z identyfikacją wizualną.
 */
import { ORG_ROLE_LABELS, type OrgRole } from '../../shared/permissions'
import type { OutgoingEmail } from './mail-types'

interface Rendered {
  subject: string
  text: string
  html: string
  /** dodatkowe nagłówki, np. List-Unsubscribe w wiadomościach do klientów */
  headers?: Record<string, string>
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface LayoutOptions {
  /** nagłówek wiadomości – domyślnie OXY; w wiadomościach do klientów nazwa warsztatu */
  brand?: string
  /** stopka: np. kontakt do warsztatu, link do ustawień powiadomień */
  footer?: { text: string, link?: { label: string, url: string } }[]
}

function layout(title: string, paragraphs: string[], action: { label: string, url: string }, options: LayoutOptions = {}) {
  const body = paragraphs.map(p => `<p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(p)}</p>`).join('')
  const footer = (options.footer ?? []).map(line => `<p style="margin:8px 0 0;font-size:12px;color:#71717a">${escapeHtml(line.text)}${
    line.link ? ` <a href="${escapeHtml(line.link.url)}" style="color:#52525b">${escapeHtml(line.link.label)}</a>` : ''
  }</p>`).join('')
  return `<!doctype html>
<html lang="pl"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
    <p style="margin:0 0 24px;font-weight:bold;font-size:18px">${escapeHtml(options.brand ?? 'OXY')}</p>
    <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
    ${body}
    <p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#18181b;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p>
    <p style="margin:0;font-size:12px;color:#71717a">Jeśli przycisk nie działa, skopiuj adres: ${escapeHtml(action.url)}</p>
    ${footer}
  </div>
</body></html>`
}

function plain(paragraphs: string[], url: string, footer: string[] = []) {
  return [...paragraphs, url, ...footer].filter(Boolean).join('\n\n')
}

/** Kontakt do warsztatu w stopce wiadomości do klienta. */
function workshopContact(d: Record<string, string>) {
  return [d.phone ? `tel. ${d.phone}` : '', d.address ?? ''].filter(Boolean).join(' · ')
}

/**
 * Wiadomości do klienta: rezygnacja z e-maili jednym kliknięciem (RFC 8058) i link do ustawień na stronie statusu.
 */
function customerFooter(d: Record<string, string>): { lines: LayoutOptions['footer'], text: string[], headers?: Record<string, string> } {
  const contact = workshopContact(d)
  const lines: NonNullable<LayoutOptions['footer']> = []
  if (contact) lines.push({ text: `${d.organizationName}: ${contact}` })
  lines.push({ text: 'Wiadomość dotyczy naprawy Twojego pojazdu.', ...(d.preferencesUrl ? { link: { label: 'Nie chcę takich e-maili', url: d.preferencesUrl } } : {}) })
  return {
    lines,
    text: [contact ? `${d.organizationName}: ${contact}` : '', d.preferencesUrl ? `Nie chcesz takich e-maili? ${d.preferencesUrl}` : ''],
    headers: d.unsubscribeUrl
      ? { 'List-Unsubscribe': `<${d.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      : undefined,
  }
}

export function renderEmail(email: OutgoingEmail): Rendered {
  const d = email.data
  switch (email.template) {
    case 'verify-email': {
      const paragraphs = [`Cześć ${d.name},`, 'potwierdź swój adres e-mail, aby dokończyć zakładanie konta w OXY.']
      return {
        subject: 'Potwierdź adres e-mail – OXY',
        text: `${paragraphs.join('\n')}\n\n${d.url}`,
        html: layout('Potwierdź adres e-mail', paragraphs, { label: 'Potwierdzam adres', url: d.url! }),
      }
    }
    case 'reset-password': {
      const paragraphs = [`Cześć ${d.name},`, 'otrzymaliśmy prośbę o zmianę hasła. Jeśli to nie Ty, zignoruj tę wiadomość.']
      return {
        subject: 'Zmiana hasła – OXY',
        text: `${paragraphs.join('\n')}\n\n${d.url}`,
        html: layout('Zmiana hasła', paragraphs, { label: 'Ustaw nowe hasło', url: d.url! }),
      }
    }
    case 'org-invitation': {
      const role = ORG_ROLE_LABELS[d.role as OrgRole] ?? d.role ?? ''
      const paragraphs = [
        `${d.inviterName} zaprasza Cię do organizacji „${d.organizationName}” w OXY.`,
        `Rola: ${role}. Zaproszenie jest ważne 7 dni.`,
      ]
      return {
        subject: `Zaproszenie do ${d.organizationName} – OXY`,
        text: `${paragraphs.join('\n')}\n\n${d.url}`,
        html: layout('Zaproszenie do zespołu', paragraphs, { label: 'Dołączam', url: d.url! }),
      }
    }
    case 'approval-request': {
      const paragraphs = [
        `${d.organizationName} prosi o decyzję w sprawie prac przy pojeździe ${d.vehicle} (zlecenie ${d.orderNumber}).`,
        ...(d.message ? [d.message] : []),
        'Na stronie zobaczysz opis, zdjęcia i ceny brutto. Każdą pozycję możesz zatwierdzić albo odrzucić osobno – bez Twojej zgody warsztat nie wykona dodatkowych prac.',
        `Link jest ważny do ${d.expires}.`,
      ]
      return {
        subject: `${d.organizationName}: prośba o decyzję – ${d.vehicle}`,
        text: `${paragraphs.join('\n\n')}\n\n${d.url}`,
        html: layout('Prośba o decyzję', paragraphs, { label: 'Zobacz i zdecyduj', url: d.url! }),
      }
    }
    case 'approval-answered': {
      const paragraphs = [
        `Klient odpowiedział na prośbę o akceptację (${d.vehicle}, zlecenie ${d.orderNumber}).`,
        `Zatwierdzone pozycje: ${d.approved}, odrzucone: ${d.rejected}.`,
        ...(d.note ? [`Uwagi klienta: ${d.note}`] : []),
      ]
      return {
        subject: `Klient odpowiedział – ${d.orderNumber}`,
        text: `${paragraphs.join('\n')}\n\n${d.url}`,
        html: layout('Decyzja klienta', paragraphs, { label: 'Otwórz zlecenie', url: d.url! }),
      }
    }
    case 'estimate-request': {
      const paragraphs = [
        `${d.organizationName} przesyła kosztorys naprawy pojazdu ${d.vehicle} (zlecenie ${d.orderNumber}) na kwotę ${d.total} brutto.`,
        ...(d.message ? [d.message] : []),
        'Na stronie zobaczysz wszystkie pozycje z cenami. Jeśli akceptujesz kosztorys, zaznacz zgodę i wyślij odpowiedź. Warsztat zapyta Cię osobno, zanim wykona prace, które zwiększą koszt.',
        `Link jest ważny do ${d.expires}.`,
      ]
      return {
        subject: `${d.organizationName}: kosztorys do akceptacji – ${d.vehicle}`,
        text: `${paragraphs.join('\n\n')}\n\n${d.url}`,
        html: layout('Kosztorys do akceptacji', paragraphs, { label: 'Zobacz kosztorys', url: d.url! }),
      }
    }
    case 'estimate-answered': {
      const paragraphs = [
        d.decision === 'approved'
          ? `Klient zaakceptował kosztorys na kwotę ${d.total} (${d.vehicle}, zlecenie ${d.orderNumber}).`
          : `Klient nie zaakceptował kosztorysu na kwotę ${d.total} (${d.vehicle}, zlecenie ${d.orderNumber}).`,
        ...(d.note ? [`Uwagi klienta: ${d.note}`] : []),
      ]
      return {
        subject: d.decision === 'approved' ? `Kosztorys zaakceptowany – ${d.orderNumber}` : `Kosztorys odrzucony – ${d.orderNumber}`,
        text: `${paragraphs.join('\n')}\n\n${d.url}`,
        html: layout('Decyzja klienta', paragraphs, { label: 'Otwórz zlecenie', url: d.url! }),
      }
    }
    case 'team-notification': {
      // Treść z tych samych tłumaczeń co dzwonek w aplikacji (server/lib/notification-texts.ts), w języku warsztatu
      const en = d.lang === 'en'
      const labels = en
        ? { open: 'Open in OXY', from: 'notification from OXY', settings: 'Notification settings' }
        : { open: 'Otwórz w OXY', from: 'powiadomienie z OXY', settings: 'Ustawienia powiadomień' }
      const paragraphs = [d.body ?? '', ...(d.note ? [d.note] : [])].filter(Boolean)
      const footer = `${d.organizationName} · ${labels.from}.`
      return {
        subject: `${d.title} – ${d.organizationName}`,
        text: plain(paragraphs, d.url!, [footer, d.settingsUrl ? `${labels.settings}: ${d.settingsUrl}` : '']),
        html: layout(d.title ?? 'OXY', paragraphs, { label: labels.open, url: d.url! }, {
          footer: [{ text: footer, ...(d.settingsUrl ? { link: { label: labels.settings, url: d.settingsUrl } } : {}) }],
        }),
      }
    }
    case 'order-received': {
      const paragraphs = [
        `Dzień dobry, przyjęliśmy pojazd ${d.vehicle} do naprawy (zlecenie ${d.orderNumber}).`,
        ...(d.promised ? [`Planowany termin odbioru: ${d.promised}.`] : []),
        'Na stronie statusu naprawy sprawdzisz, na jakim etapie są prace. Jeśli trzeba będzie wykonać coś więcej, najpierw zapytamy Cię o zgodę i podamy cenę.',
      ]
      const footer = customerFooter(d)
      return {
        subject: `${d.organizationName}: przyjęliśmy pojazd ${d.vehicle}`,
        text: plain(paragraphs, d.url!, footer.text),
        html: layout('Pojazd przyjęty do naprawy', paragraphs, { label: 'Sprawdź status naprawy', url: d.url! }, {
          brand: d.organizationName,
          footer: footer.lines,
        }),
        headers: footer.headers,
      }
    }
    case 'order-ready': {
      const paragraphs = [
        `Dzień dobry, pojazd ${d.vehicle} jest gotowy do odbioru (zlecenie ${d.orderNumber}).`,
        ...(d.address ? [`Zapraszamy: ${d.address}.`] : []),
        'Szczegóły znajdziesz na stronie statusu naprawy.',
      ]
      const footer = customerFooter(d)
      return {
        subject: `${d.organizationName}: ${d.vehicle} gotowy do odbioru`,
        text: plain(paragraphs, d.url!, footer.text),
        html: layout('Pojazd gotowy do odbioru', paragraphs, { label: 'Zobacz szczegóły', url: d.url! }, {
          brand: d.organizationName,
          footer: footer.lines,
        }),
        headers: footer.headers,
      }
    }
  }
}
