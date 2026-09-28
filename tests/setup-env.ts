try {
  process.loadEnvFile('.env')
}
catch {
  // CI ustawia zmienne bezpośrednio
}
