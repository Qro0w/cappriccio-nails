// Shrinks big phone photos before upload (faster on mobile data). Falls back to the original file.
export async function compressImage(file, { maxDim = 1600, quality = 0.85 } = {}) {
  const fallback = { blob: file, type: file.type || 'image/jpeg', ext: (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg') }
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return fallback
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return fallback
    return { blob, type: 'image/jpeg', ext: 'jpg' }
  } catch { return fallback }
}
