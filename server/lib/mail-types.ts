export type EmailTemplate = 'verify-email' | 'reset-password' | 'org-invitation' | 'approval-request' | 'approval-answered'
  | 'estimate-request' | 'estimate-answered'

export interface OutgoingEmail {
  to: string
  template: EmailTemplate
  data: Record<string, string>
}
