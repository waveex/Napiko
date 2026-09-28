/**
 * Wysyłka plików do magazynu przez podpisany adres (z pominięciem serwera aplikacji):
 * 1) rejestracja pliku, 2) PUT prosto do S3, 3) potwierdzenie.
 *
 * Zdjęcia przed wysłaniem pomniejszamy i zapisujemy ponownie jako JPEG – to usuwa metadane EXIF
 * (m.in. lokalizację GPS z telefonu) i przyspiesza wysyłkę na słabym zasięgu w warsztacie.
 * Dłuższy bok ok. 1600 px – decyzja D7 (docs/02-decyzje-produktowe.md).
 */
const MAX_EDGE = 1600
const RECODE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

async function prepareImage(file: File): Promise<File> {
  if (!RECODE_TYPES.includes(file.type) || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  }
  catch {
    // np. HEIC w przeglądarce bez obsługi – wysyłamy oryginał
    return file
  }
}

export function useStorageUpload() {
  async function upload(original: File, purpose: 'logo' | 'attachment' = 'attachment') {
    const file = purpose === 'attachment' ? await prepareImage(original) : original
    const target = await $fetch('/api/files/upload-url', {
      method: 'POST',
      body: { fileName: file.name, contentType: file.type, sizeBytes: file.size, purpose },
    })
    const response = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await $fetch(`/api/files/${target.fileId}/complete`, { method: 'POST' })
    return target.fileId
  }
  return { upload }
}
