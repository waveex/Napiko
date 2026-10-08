// Odczyt konfiguracji konta i sprawdzenie TLS. Nie wysyła SMS ani nie drukuje tokenu.
try {
  process.loadEnvFile('.env')
}
catch {
  // Na serwerze sekrety są przekazywane przez środowisko.
}

try {
  const token = process.env.SMSAPI_TOKEN?.trim()
  if (!token) throw new Error('Brak SMSAPI_TOKEN.')
  const tls = await fetch('https://certificate-test.smsapi.com/', {
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  })
  if (!tls.ok || (await tls.text()).trim() !== 'OK') throw new Error('Test certyfikatu TLS nie powiódł się.')
  console.info('Certyfikat TLS: OK')

  const response = await fetch('https://api.smsapi.pl/sms/sendernames', {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(data?.collection)) {
    throw new Error(`Nie można odczytać nadawców (HTTP ${response.status}). Sprawdź token i uprawnienia sms_sendernames.`)
  }
  console.info('Autoryzacja i odczyt nadawców: OK')
  for (const sender of data.collection) {
    console.info(JSON.stringify({ sender: sender.sender, status: sender.status, default: sender.is_default }))
  }
  console.info('Nie wysłano żadnej wiadomości. Odczyt nadawców nie potwierdza uprawnień do wysyłki ani salda konta.')
}
catch (error) {
  // Nigdy nie wypisujemy requestu, nagłówków ani surowej odpowiedzi API.
  console.error(error instanceof Error ? error.message : 'Sprawdzenie SMSAPI nie powiodło się.')
  process.exitCode = 1
}
