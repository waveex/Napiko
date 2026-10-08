/**
 * Szablony e-maili (PL). Proste HTML + tekst. Wiadomości zespołu i konta mają paletę warsztatu i logo Napiko;
 * wiadomości do klienta paletę klienta, na pierwszym planie nazwę warsztatu, a Napiko jako oznaczenie platformy.
 */
import { BRAND_COLORS, type BrandContext } from '../../shared/brand'
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
  /** nagłówek wiadomości – domyślnie logo Napiko; w wiadomościach do klientów nazwa warsztatu */
  brand?: string
  /** stopka: np. kontakt do warsztatu, link do ustawień powiadomień */
  footer?: { text: string, link?: { label: string, url: string } }[]
  /** paleta: warsztat (domyślnie) albo klient; wiadomość do klienta kończy się oznaczeniem platformy */
  theme?: BrandContext
  /** publiczny adres aplikacji: obrazy w e-mailu muszą mieć adres bezwzględny, bez niego zostaje sama nazwa */
  appUrl?: string
}

/** Oznaczenie platformy w wiadomościach do klienta (HTML z logo, tekst bez). */
const PLATFORM_LINE = 'Wiadomość wysłana przez platformę Napiko.'

/** Logo jako PNG w podwójnej rozdzielczości (public/brand, `pnpm brand:build`); alt zastępuje je, gdy klient poczty blokuje obrazy. */
function logo(appUrl: string, theme: BrandContext, width: number) {
  const height = Math.round(width * 240 / 1232)
  const src = `${appUrl}/brand/napiko-logo-${theme}-email.png`
  return `<img src="${escapeHtml(src)}" width="${width}" height="${height}" alt="Napiko" style="display:block;border:0;outline:none;text-decoration:none;width:${width}px;height:${height}px">`
}

function layout(title: string, paragraphs: string[], action: { label: string, url: string }, options: LayoutOptions = {}) {
  const theme = options.theme ?? 'workshop'
  const color = BRAND_COLORS[theme]
  const body = paragraphs.map(p => `<p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(p)}</p>`).join('')
  const footer = (options.footer ?? []).map(line => `<p style="margin:8px 0 0;font-size:12px;color:${color.muted}">${escapeHtml(line.text)}${
    line.link ? ` <a href="${escapeHtml(line.link.url)}" style="color:${color.muted}">${escapeHtml(line.link.label)}</a>` : ''
  }</p>`).join('')
  const header = options.brand
    ? `<p style="margin:0 0 24px;font-weight:bold;font-size:18px">${escapeHtml(options.brand)}</p>`
    : `<div style="margin:0 0 24px">${options.appUrl ? logo(options.appUrl, theme, 160) : `<span style="font-weight:bold;font-size:18px">Napiko</span>`}</div>`
  const platform = theme === 'customer'
    ? `<div style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${color.border};font-size:12px;color:${color.muted}"><p style="margin:0 0 8px">${PLATFORM_LINE}</p>${options.appUrl ? logo(options.appUrl, theme, 96) : ''}</div>`
    : ''
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:${color.background};font-family:Arial,Helvetica,sans-serif;color:${color.text}">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid ${color.border};border-radius:8px;padding:32px">
    ${header}
    <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
    ${body}
    <p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:${color.action};color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">${escapeHtml(action.label)}</a></p>
    <p style="margin:0;font-size:12px;color:${color.muted}">Jeśli przycisk nie działa, skopiuj adres: ${escapeHtml(action.url)}</p>
    ${footer}
    ${platform}
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
    text: [contact ? `${d.organizationName}: ${contact}` : '', d.preferencesUrl ? `Nie chcesz takich e-maili? ${d.preferencesUrl}` : '', PLATFORM_LINE],
    headers: d.unsubscribeUrl
      ? { 'List-Unsubscribe': `<${d.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      : undefined,
  }
}

export function renderEmail(email: OutgoingEmail, context: { appUrl?: string } = {}): Rendered {
  const d = email.data
  const page: typeof layout = (title, paragraphs, action, options) => layout(title, paragraphs, action, { appUrl: context.appUrl, ...options })
  switch (email.template) {
    case 'verify-email': {
      const paragraphs = [`Cześć ${d.name},`, 'potwierdź swój adres e-mail, aby dokończyć zakładanie konta w Napiko.']
      return {
        subject: 'Potwierdź adres e-mail – Napiko',
        text: `${paragraphs.join('\n')}\n\n${d.url}`,
        html: page('Potwierdź adres e-mail', paragraphs, { label: 'Potwierdzam adres', url: d.url! }),
      }
    }
    case 'reset-password': {
      const paragraphs = [`Cześć ${d.name},`, 'otrzymaliśmy prośbę o zmianę hasła. Jeśli to nie Ty, zignoruj tę wiadomość.']
      return {
        subject: 'Zmiana hasła – Napiko',
        text: `${paragraphs.join('\n')}\n\n${d.url}`,
        html: page('Zmiana hasła', paragraphs, { label: 'Ustaw nowe hasło', url: d.url! }),
      }
    }
    case 'org-invitation': {
      const role = ORG_ROLE_LABELS[d.role as OrgRole] ?? d.role ?? ''
      const paragraphs = [
        `${d.inviterName} zaprasza Cię do organizacji „${d.organizationName}” w Napiko.`,
        `Rola: ${role}. Zaproszenie jest ważne 7 dni.`,
      ]
      return {
        subject: `Zaproszenie do ${d.organizationName} – Napiko`,
        text: `${paragraphs.join('\n')}\n\n${d.url}`,
        html: page('Zaproszenie do zespołu', paragraphs, { label: 'Dołączam', url: d.url! }),
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
        text: plain(paragraphs, d.url!, [PLATFORM_LINE]),
        html: page('Prośba o decyzję', paragraphs, { label: 'Zobacz i zdecyduj', url: d.url! }, { brand: d.organizationName, theme: 'customer' }),
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
        html: page('Decyzja klienta', paragraphs, { label: 'Otwórz zlecenie', url: d.url! }),
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
        text: plain(paragraphs, d.url!, [PLATFORM_LINE]),
        html: page('Kosztorys do akceptacji', paragraphs, { label: 'Zobacz kosztorys', url: d.url! }, { brand: d.organizationName, theme: 'customer' }),
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
        html: page('Decyzja klienta', paragraphs, { label: 'Otwórz zlecenie', url: d.url! }),
      }
    }
    case 'team-notification': {
      // Treść z tych samych tłumaczeń co dzwonek w aplikacji (server/lib/notification-texts.ts), w języku warsztatu
      const en = d.lang === 'en'
      const labels = en
        ? { open: 'Open in Napiko', from: 'notification from Napiko', settings: 'Notification settings' }
        : { open: 'Otwórz w Napiko', from: 'powiadomienie z Napiko', settings: 'Ustawienia powiadomień' }
      const paragraphs = [d.body ?? '', ...(d.note ? [d.note] : [])].filter(Boolean)
      const footer = `${d.organizationName} · ${labels.from}.`
      return {
        subject: `${d.title} – ${d.organizationName}`,
        text: plain(paragraphs, d.url!, [footer, d.settingsUrl ? `${labels.settings}: ${d.settingsUrl}` : '']),
        html: page(d.title ?? 'Napiko', paragraphs, { label: labels.open, url: d.url! }, {
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
        html: page('Pojazd przyjęty do naprawy', paragraphs, { label: 'Sprawdź status naprawy', url: d.url! }, {
          brand: d.organizationName,
          theme: 'customer',
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
        html: page('Pojazd gotowy do odbioru', paragraphs, { label: 'Zobacz szczegóły', url: d.url! }, {
          brand: d.organizationName,
          theme: 'customer',
          footer: footer.lines,
        }),
        headers: footer.headers,
      }
    }
  }
}
