/**
 * Nowa para kluczy VAPID do powiadomień push:  pnpm push:keys
 * Wklej wynik do .env (lokalnie) albo do zmiennych środowiskowych Netlify. Zmiana kluczy
 * unieważnia wszystkie subskrypcje – użytkownicy muszą ponownie włączyć powiadomienia.
 */
import { generateVapidKeys } from '../server/lib/push'

const keys = generateVapidKeys()
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
