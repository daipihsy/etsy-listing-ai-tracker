import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { Plus, X, Clipboard } from 'lucide-react'
import { fileToDataUrl } from './ImageInput'

export function MultiImageInput({
  value,
  onChange
}: {
  value: string[]
  onChange: (v: string[]) => void
}): JSX.Element {
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function addFiles(files: FileList | null): Promise<void> {
    if (!files) return
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const urls = await Promise.all(imgs.map(fileToDataUrl))
    if (urls.length) onChange([...value, ...urls])
  }

  async function handlePaste(e: ClipboardEvent): Promise<void> {
    const items = Array.from(e.clipboardData.items).filter((i) => i.type.startsWith('image/'))
    if (items.length) {
      e.preventDefault()
      const urls = await Promise.all(
        items.map((i) => i.getAsFile()).filter(Boolean).map((b) => fileToDataUrl(b as Blob))
      )
      onChange([...value, ...urls])
    }
  }

  async function pasteFromClipboard(): Promise<void> {
    const url = await window.api.clipboard.image()
    if (url) onChange([...value, url])
  }

  function removeAt(i: number): void {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setOver(false)
          addFiles(e.dataTransfer.files)
        }}
        className={`no-drag flex flex-wrap gap-2 rounded-xl border-2 border-dashed p-2 outline-none transition ${
          over ? 'border-etsy bg-etsy/5' : 'border-black/15 bg-black/[0.02] focus:border-etsy'
        }`}
      >
        {value.map((url, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-black/10">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => removeAt(i)}
              className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-black/20 text-black/35 hover:border-etsy hover:text-etsy"
        >
          <Plus size={18} />
          <span className="text-[10px]">添加</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-black/40">
        <span>点上面区域后按 ⌘V 粘贴，或拖拽 / 点「添加」上传</span>
        <button
          onClick={pasteFromClipboard}
          className="inline-flex items-center gap-1 text-black/50 hover:text-etsy"
        >
          <Clipboard size={12} /> 从剪贴板
        </button>
      </div>
    </div>
  )
}
