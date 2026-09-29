/**
 * Konfiguracja serwera ze zmiennych środowiskowych (walidowana przez zod).
 * Moduł nie zależy od Nuxta, więc korzystają z niego też skrypty i testy.
 */
import { z } from 'zod'

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform(v => v === 'true' || v === '1')

/** Zmienna opcjonalna: pusta wartość (np. `VAPID_PUBLIC_KEY=` w .env) oznacza brak ustawienia. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v), schema.optional())
}

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),

  /**
   * Adres aplikacji, np. http://localhost:3000 albo https://oxy.netlify.app.
   * Na podglądach Netlify ustawia go wtyczka server/plugins/00.env.ts (adres z czasu budowania).
   */
  BETTER_AUTH_URL: z.url().optional(),
  /** Główny adres serwisu – Netlify udostępnia go funkcjom w czasie działania. */
  URL: z.url().optional(),

  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET musi mieć co najmniej 32 znaki'),
  AUTH_REQUIRE_EMAIL_VERIFICATION: bool.default(true),
  /** Dodatkowe zaufane originy (np. aplikacja mobilna), rozdzielone przecinkami. */
  AUTH_TRUSTED_ORIGINS: z.string().optional(),

  /** Poczta wychodząca: lokalnie Mailpit (smtp://localhost:1025). */
  SMTP_URL: z.string().default('smtp://localhost:1025'),
  MAIL_FROM: z.string().default('OXY <no-reply@oxy.local>'),

  /** Magazyn plików zgodny z S3 (lokalnie MinIO, produkcyjnie np. OVHcloud Object Storage w UE). */
  S3_ENDPOINT: z.url().optional(),
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('oxy-dev'),
  S3_ACCESS_KEY_ID: z.string().default('oxy'),
  S3_SECRET_ACCESS_KEY: z.string().default('oxy-secret'),
  S3_FORCE_PATH_STYLE: bool.default(true),

  /** Klucz do wywołań wewnętrznych (funkcja cykliczna → kolejka zadań). */
  INTERNAL_API_KEY: z.string().min(24, 'INTERNAL_API_KEY musi mieć co najmniej 24 znaki').optional(),

  /**
   * Dostawca SMS: "log" (tylko zapis w logach, bez wysyłki) albo "smsapi" (SMSAPI.pl – bramka w PL).
   * Nazwa nadawcy (np. nazwa warsztatu) musi być wcześniej zarejestrowana u dostawcy.
   */
  SMS_PROVIDER: z.enum(['log', 'smsapi']).default('log'),
  SMSAPI_TOKEN: z.string().min(10).optional(),

  /**
   * Powiadomienia push (Web Push): para kluczy VAPID z `pnpm push:keys`. Bez kluczy push jest wyłączony –
   * zespół ma dzwonek w aplikacji i e-maile, a klient dostaje SMS-y. Zmiana kluczy unieważnia włączone powiadomienia.
   */
  VAPID_PUBLIC_KEY: optional(z.string().regex(/^[\w-]{80,100}$/, 'VAPID_PUBLIC_KEY: klucz publiczny z `pnpm push:keys` (base64url)')),
  VAPID_PRIVATE_KEY: optional(z.string().regex(/^[\w-]{40,50}$/, 'VAPID_PRIVATE_KEY: klucz prywatny z `pnpm push:keys` (base64url)')),
  /** Kontakt dla operatorów usług push (mailto: albo https://); domyślnie adres z MAIL_FROM. */
  VAPID_SUBJECT: optional(z.string().regex(/^(mailto:|https:\/\/)\S+$/, 'VAPID_SUBJECT: mailto:adres@domena albo https://…')),
})

export type Env = z.infer<typeof EnvSchema> & { appUrl: string }

let cached: Env | undefined

export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Niepoprawna konfiguracja środowiska:\n${issues}`)
  }
  const data = parsed.data
  const appUrl = data.BETTER_AUTH_URL ?? data.URL ?? 'http://localhost:3000'
  const env = { ...data, appUrl: appUrl.replace(/\/$/, '') }
  if (source === process.env) cached = env
  return env
}
