/**
 * Lokalne uruchomienie OXY jednym poleceniem:
 *   pnpm run local
 *
 * Po kolei: .env (z .env.example i losowymi sekretami, jeśli go brak) → Docker (w razie potrzeby
 * uruchamia Docker Desktop) → pnpm install, gdy zmienił się pnpm-lock.yaml → usługi w Dockerze →
 * migracje bazy i bucket na pliki → serwer deweloperski na http://localhost:3000.
 * Czysty Node bez zależności, więc działa też przed pierwszym pnpm install.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

process.chdir(join(import.meta.dirname, '..'))

const step = title => console.log(`\n\x1b[36m==> ${title}\x1b[0m`)

function fail(message) {
  console.error(`\n\x1b[31m✖ ${message}\x1b[0m`)
  process.exit(1)
}

/** Polecenie w powłoce (na Windowsie pnpm to plik .cmd); przy błędzie przerywa skrypt. */
function sh(command) {
  const { status } = spawnSync(command, { stdio: 'inherit', shell: true })
  if (status !== 0) fail(`Nie powiodło się: ${command}`)
}

const dockerRunning = () => spawnSync('docker info', { stdio: 'ignore', shell: true, timeout: 20_000 }).status === 0
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')

// 1. Konfiguracja
if (!existsSync('.env')) {
  step('Tworzę .env z .env.example (z losowymi sekretami)')
  const secret = () => randomBytes(32).toString('base64url')
  const env = readFileSync('.env.example', 'utf8')
    .replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret()}`)
    .replace(/^INTERNAL_API_KEY=.*$/m, `INTERNAL_API_KEY=${secret()}`)
  writeFileSync('.env', env)
}

// 2. Docker
if (!dockerRunning()) {
  step('Uruchamiam Docker Desktop')
  if (process.platform === 'win32') {
    const exe = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Docker', 'Docker', 'Docker Desktop.exe')
    if (!existsSync(exe)) fail(`Nie znalazłem Docker Desktop (${exe}). Zainstaluj go albo uruchom Dockera ręcznie.`)
    spawn(exe, { detached: true, stdio: 'ignore' }).unref()
  }
  else if (process.platform === 'darwin') {
    spawnSync('open -a Docker', { shell: true })
  }
  else {
    fail('Docker nie działa. Uruchom usługę Dockera i spróbuj ponownie.')
  }
  const deadline = Date.now() + 3 * 60_000
  while (!dockerRunning()) {
    if (Date.now() > deadline) fail('Docker nie wystartował w ciągu 3 minut.')
    await sleep(3000)
  }
}

// 3. Zależności – tylko gdy lockfile różni się od zainstalowanego
const installedLock = join('node_modules', '.pnpm', 'lock.yaml')
if (!existsSync(installedLock) || sha256(installedLock) !== sha256('pnpm-lock.yaml')) {
  step('Instaluję zależności (zmienił się pnpm-lock.yaml)')
  sh('pnpm install')
}

// 4. Usługi, baza, serwer
step('Usługi w Dockerze: PostgreSQL, MinIO (S3), Mailpit')
sh('pnpm run infra:up')

step('Migracje bazy i bucket na pliki')
sh('pnpm run setup')

step('Serwer deweloperski: http://localhost:3000 (poczta: http://localhost:8025), Ctrl+C kończy')
process.exit(spawnSync('pnpm run dev', { stdio: 'inherit', shell: true }).status ?? 0)
