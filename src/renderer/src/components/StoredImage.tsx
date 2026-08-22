import { useEffect, useState } from 'react'
import { ImageIcon } from 'lucide-react'

const cache = new Map<string, string>()

export function StoredImage({
  filename,
  className = '',
  alt = ''
}: {
  filename: string | null | undefined
  className?: string
  alt?: string
}): JSX.Element {
  const [src, setSrc] = useState<string | null>(filename ? cache.get(filename) || null : null)

  useEffect(() => {
    let alive = true
    if (!filename) {
      setSrc(null)
      return
    }
    if (cache.has(filename)) {
      setSrc(cache.get(filename)!)
      return
    }
    window.api.image.dataUrl(filename).then((url) => {
      if (alive && url) {
        cache.set(filename, url)
        setSrc(url)
      }
    })
    return () => {
      alive = false
    }
  }, [filename])

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-black/5 text-black/20 ${className}`}>
        <ImageIcon size={28} />
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} />
}
