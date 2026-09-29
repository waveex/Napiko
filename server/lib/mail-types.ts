export type EmailTemplate = 'verify-email' | 'reset-password' | 'org-invitation' | 'approval-request' | 'approval-answered'
  | 'estimate-request' | 'estimate-answered' | 'team-notification' | 'order-received' | 'order-ready'

export interface OutgoingEmail {
  to: string
  template: EmailTemplate
  data: Record<string, string>
  /**
   * Klucz idempotencji (id zadania z kolejki): stały Message-ID, więc ponowna wysyłka tego samego zadania
   * (kolejka działa „co najmniej raz”) jest dla programów pocztowych tą samą wiadomością.
   */
  idempotencyKey?: string
}
