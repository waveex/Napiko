/**
 * Adres z nagłówka List-Unsubscribe otwarty w przeglądarce: bez zmian (GET nie może niczego wyłączać –
 * robią to skanery linków), tylko przejście do ustawień powiadomień na stronie statusu naprawy.
 */
import { statusTokenSchema } from '../../../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, params => statusTokenSchema.parse(params))
  return sendRedirect(event, `/s/${token}#powiadomienia`, 302)
})
