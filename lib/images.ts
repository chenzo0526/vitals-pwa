// Client-side image utilities. iPhone HDR shots are 4-8MB out of the camera;
// resize to ~1024px max edge and re-encode as JPEG 80% before sending to AI.

export type CompressedImage = {
  base64: string                       // base64 *without* the data:... prefix
  mediaType: 'image/jpeg' | 'image/png'
  bytes: number
  width: number
  height: number
}

const DEFAULT_MAX_EDGE = 1024
const DEFAULT_QUALITY = 0.8

/**
 * Resize + re-encode an image client-side. Caps the longest edge to maxEdge,
 * emits JPEG by default (smaller than PNG for photos). Falls back to the raw
 * file if anything goes wrong — we'd rather send the full image than block.
 */
export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number; mimeType?: 'image/jpeg' | 'image/png' } = {},
): Promise<CompressedImage> {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE
  const quality = opts.quality ?? DEFAULT_QUALITY
  const targetMime = opts.mimeType ?? 'image/jpeg'

  try {
    const bitmap = await readBitmap(file)
    const { width: w0, height: h0 } = bitmap
    const scale = Math.min(1, maxEdge / Math.max(w0, h0))
    const w = Math.round(w0 * scale)
    const h = Math.round(h0 * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { alpha: targetMime === 'image/png' })
    if (!ctx) throw new Error('canvas 2d unavailable')
    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.drawImage(bitmap as any, 0, 0, w, h)
    if ('close' in bitmap) (bitmap as ImageBitmap).close()

    const dataUrl = canvas.toDataURL(targetMime, quality)
    const base64 = dataUrl.split(',')[1] || ''
    const bytes = Math.floor((base64.length * 3) / 4)
    return { base64, mediaType: targetMime, bytes, width: w, height: h }
  } catch (e) {
    // Last-resort fallback: pass through raw bytes.
    console.warn('[images] compress fallback:', e)
    const buf = await file.arrayBuffer()
    const base64 = bufferToBase64(buf)
    const mime = (file.type === 'image/png' ? 'image/png' : 'image/jpeg') as 'image/jpeg' | 'image/png'
    return { base64, mediaType: mime, bytes: buf.byteLength, width: 0, height: 0 }
  }
}

async function readBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation 'from-image' applies EXIF rotation; not all browsers support it.
      return await createImageBitmap(file, { imageOrientation: 'from-image' as ImageOrientation })
    } catch {
      return await createImageBitmap(file)
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = URL.createObjectURL(file)
  })
}

function bufferToBase64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j])
    }
  }
  return btoa(binary)
}

/** Friendly KB/MB label for the "Optimized to N KB" caption. */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}
