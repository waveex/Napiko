/**
 * Idempotencja wysyłek: SMSAPI (idx + check_idx, błąd 53 = już wysłane) i stały Message-ID e-maila.
 */
import { afterEach, expect, it, vi } from 'vitest'
import { createSmsSender, smsapiIdx } from '../server/lib/sms'
import { messageIdFor } from '../server/lib/mailer'
import { getEnv } from '../server/lib/env'

afterEach(() => {
  vi.unstubAllGlobals()
})

function smsapi(response: object) {
  const calls: URLSearchParams[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
    calls.push(init.body)
    return new Response(JSON.stringify(response), { status: 200 })
  }))
  const sender = createSmsSender(getEnv({ ...process.env, SMS_PROVIDER: 'smsapi', SMSAPI_TOKEN: 'token-testowy-123' }))
  return { sender, calls }
}

it('SMSAPI dostaje idx z klucza idempotencji i check_idx', async () => {
  const { sender, calls } = smsapi({ count: 1 })
  await sender.send({ to: '+48600100200', message: 'Test', idempotencyKey: 'CE8C7D88-4704-4809-bd08-e5d77c1a314b-sms' })
  expect(calls[0]!.get('idx')).toBe('ce8c7d8847044809bd08e5d77c1a314bsms')
  expect(calls[0]!.get('check_idx')).toBe('1')
  expect(calls[0]!.get('to')).toBe('48600100200')
})

it('duplikat idx (błąd 53) to sukces – SMS już wyszedł', async () => {
  const { sender } = smsapi({ error: 53, message: 'Not unique idx' })
  await expect(sender.send({ to: '+48600100200', message: 'Test', idempotencyKey: 'abc' })).resolves.toBeUndefined()
})

it('inny błąd SMSAPI jest błędem (kolejka ponowi)', async () => {
  const { sender } = smsapi({ error: 101, message: 'Authorization failed' })
  await expect(sender.send({ to: '+48600100200', message: 'Test', idempotencyKey: 'abc' })).rejects.toThrow(/Authorization failed/)
})

it('idx: tylko litery i cyfry, maks. 255 znaków', () => {
  expect(smsapiIdx('A-b_c!'.repeat(100))).toMatch(/^[a-z0-9]{1,255}$/)
})

it('Message-ID w domenie nadawcy, stały dla klucza', () => {
  expect(messageIdFor('job-1-email', 'OXY <no-reply@oxy.pl>')).toBe('<oxy-job-1-email@oxy.pl>')
  expect(messageIdFor('job-1-email', 'OXY <no-reply@oxy.pl>')).toBe(messageIdFor('job-1-email', 'OXY <no-reply@oxy.pl>'))
})
