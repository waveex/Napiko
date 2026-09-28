/**
 * Przygotowuje magazyn plików (bucket S3 i reguły CORS dla wysyłki z przeglądarki).
 *   pnpm storage:init
 */
import { createStorage } from '../server/lib/storage'
import { getEnv } from '../server/lib/env'

try {
  process.loadEnvFile('.env')
}
catch {
  // brak .env
}

const env = getEnv()
const storage = createStorage(env)
const result = await storage.ensureBucket([env.appUrl])
console.log(`Bucket "${env.S3_BUCKET}": ${result.created ? 'utworzony' : 'już istnieje'}; CORS: ${result.cors}.`)
