/**
 * Magazyn plików zgodny z S3 (lokalnie MinIO; produkcyjnie np. OVHcloud Object Storage w UE).
 *
 * Pliki (zdjęcia, wideo) nie przechodzą przez funkcje serwerowe – limit Netlify to ok. 6 MB na żądanie.
 * Serwer wydaje krótkotrwałe, podpisane adresy URL, a przeglądarka wysyła plik bezpośrednio do magazynu.
 */
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Env } from './env'

export function createStorage(env: Env) {
  const base: S3ClientConfig = {
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    // Nowsze wersje SDK domyślnie dodają sumy kontrolne CRC32, których nie obsługują
    // podpisane adresy wysyłki ani część dostawców zgodnych z S3.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  }
  const client = new S3Client({ ...base, endpoint: env.S3_ENDPOINT })
  // Adresy dla przeglądarki mogą wymagać innego hosta niż połączenie serwer → magazyn.
  const signer = env.S3_PUBLIC_ENDPOINT ? new S3Client({ ...base, endpoint: env.S3_PUBLIC_ENDPOINT }) : client
  const bucket = env.S3_BUCKET

  return {
    bucket,

    presignUpload(key: string, contentType: string, sizeBytes: number, expiresIn = 600) {
      return getSignedUrl(
        signer,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes }),
        { expiresIn },
      )
    },

    presignDownload(key: string, fileName: string, expiresIn = 300) {
      return getSignedUrl(
        signer,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        }),
        { expiresIn },
      )
    },

    async head(key: string): Promise<{ sizeBytes: number, contentType?: string } | null> {
      try {
        const out = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        return { sizeBytes: out.ContentLength ?? 0, contentType: out.ContentType }
      }
      catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        if (status === 404) return null
        throw error
      }
    },

    /** Trwałe usunięcie obiektu (wywoływane z kolejki zadań po usunięciu załącznika). */
    async remove(key: string) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },

    async ensureBucket(corsOrigins: string[]) {
      let created = false
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }))
      }
      catch {
        await client.send(new CreateBucketCommand({ Bucket: bucket }))
        created = true
      }
      let cors = 'ustawione'
      try {
        await client.send(new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: {
            CORSRules: [{
              AllowedOrigins: corsOrigins,
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            }],
          },
        }))
      }
      catch {
        // MinIO ustawia CORS zmienną środowiskową (docker-compose.yml), a nie przez API.
        cors = 'pominięte (dostawca konfiguruje CORS inaczej)'
      }
      return { created, cors }
    },
  }
}

export type FileStorage = ReturnType<typeof createStorage>
