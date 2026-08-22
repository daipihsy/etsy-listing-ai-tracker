import { useRef, useState, type DragEvent, type ClipboardEvent } from 'react'
import { Clipboard, Upload } from 'lucide-react'

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export function ImageInput({
  value,
  onChange,
  label = '粘贴 / 拖拽 / 点击上传图片',
  height = 'h-52'
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
  label?: string
  height?: string
}): JSX.Element {
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null): Promise<void> {
    const f = files?.[0]
    if (f && f.type.startsWith('image/')) onChange(await fileToDataUrl(f))
  }

  async function handlePaste(e: ClipboardEvent): Promise<void> {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    if (item) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (blob) onChange(await fileToDataUrl(blob))
    }
  }

  async function pasteFromClipboard(): Promise<void> {
    const url = await window.api.clipboard.image()
    if (url) onChange(url)
  }

  return (
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
        handleFiles(e.dataTransfer.files)
      }}
      className={`no-drag relative ${height} w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed outline-none transition ${
        over ? 'border-etsy bg-etsy/5' : 'border-black/15 bg-black/[0.02] focus:border-etsy'
      }`}
      onClick={() => !value && fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {value ? (
        <>
          <img src={value} alt="" className="h-full w-full object-contain" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                fileRef.current?.click()
              }}
              className="rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
            >
              替换
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
            >
              移除
            </button>
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-black/40">
          <Upload size={26} />
          <p className="text-sm">{label}</p>
          <p className="text-xs text-black/30">点击此处后按 ⌘V 可直接粘贴截图</p>
          <button
            onClick={(e) => {
              e.stopPropagation()
              pasteFromClipboard()
            }}
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-black/5 px-2.5 py-1 text-xs text-black/60 hover:bg-black/10"
          >
            <Clipboard size={13} /> 从剪贴板读取
          </button>
        </div>
      )}
    </div>
  )
}
