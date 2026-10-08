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
  const { sender, calls } = smsapi({ count: 1, list: [{ id: 'sms-123' }] })
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
  await expect(sender.send({ to: '+48600100200', message: 'Test', idempotencyKey: 'abc' })).rejects.toThrow(/kod 101/)
})

it('idx: tylko litery i cyfry, maks. 255 znaków', () => {
  expect(smsapiIdx('A-b_c!'.repeat(100))).toMatch(/^[a-z0-9]{1,255}$/)
})

it.each([null, {}, { count: 0, list: [] }, { count: 1, list: [{ id: '' }] }, { count: 1, list: [{ id: '123', error: 13 }] }])('nie uznaje niepoprawnego potwierdzenia za wysłany SMS: %j', async (data) => {
  const { sender } = smsapi(data as object)
  await expect(sender.send({ to: '+48600100200', message: 'Test' })).rejects.toThrow(/potwierdzenia/)
})

it('błąd duplikatu bez klucza nie jest sukcesem', async () => {
  const { sender } = smsapi({ error: 53 })
  await expect(sender.send({ to: '+48600100200', message: 'Test' })).rejects.toThrow(/kod 53/)
})

it('używa HTTPS, Bearer i nazwy nadawcy, blokuje przekierowania', async () => {
  const { sender, calls } = smsapi({ count: 1, list: [{ id: '123', error: null }] })
  await sender.send({ to: '+48600100200', message: 'Test', from: 'Napiko' })
  expect(calls[0]!.get('from')).toBe('Napiko')
  expect(calls[0]!.get('encoding')).toBe('utf-8')
  expect(calls[0]!.has('access_token')).toBe(false)
  expect(fetch).toHaveBeenCalledWith('https://api.smsapi.pl/sms.do', expect.objectContaining({
    method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer token-testowy-123' },
  }))
})

it('HTTP 500 i odpowiedź bez JSON nie są sukcesem', async () => {
  const { sender } = smsapi({})
  vi.mocked(fetch).mockResolvedValueOnce(new Response('Gateway error', { status: 500 }))
  await expect(sender.send({ to: '+48600100200', message: 'Test' })).rejects.toThrow(/HTTP 500/)
  vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 200 }))
  await expect(sender.send({ to: '+48600100200', message: 'Test' })).rejects.toThrow(/potwierdzenia/)
})

it('awaria połączenia pozostaje błędem do ponowienia w kolejce', async () => {
  const { sender } = smsapi({})
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'))
  await expect(sender.send({ to: '+48600100200', message: 'Test' })).rejects.toThrow(/fetch failed/)
})

it('weryfikuje token przy starcie i pozwala na pusty token w trybie log', () => {
  expect(() => getEnv({ ...process.env, SMS_PROVIDER: 'smsapi', SMSAPI_TOKEN: '' })).toThrow(/wymaga SMSAPI_TOKEN/)
  expect(getEnv({ ...process.env, SMS_PROVIDER: 'log', SMSAPI_TOKEN: '' }).SMSAPI_TOKEN).toBeUndefined()
})

it('Message-ID w domenie nadawcy, stały dla klucza', () => {
  expect(messageIdFor('job-1-email', 'Napiko <no-reply@napiko.pl>')).toBe('<napiko-job-1-email@napiko.pl>')
  expect(messageIdFor('job-1-email', 'Napiko <no-reply@napiko.pl>')).toBe(messageIdFor('job-1-email', 'Napiko <no-reply@napiko.pl>'))
})
