import { useState } from 'react'
import { Modal, Field, Button, inputCls } from './ui'
import { ImageInput } from './ImageInput'
import { useToast } from './Toast'

export function NewListingModal({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: () => void
}): JSX.Element {
  const toast = useToast()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(): Promise<void> {
    if (!name.trim()) {
      toast('请填写 Listing Name', 'error')
      return
    }
    setSaving(true)
    try {
      await window.api.listings.create({
        name: name.trim(),
        etsy_url: url.trim() || null,
        notes: notes.trim() || null,
        imageDataUrl: image
      })
      toast('已创建 Listing', 'success')
      onCreated()
      onClose()
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="新建 Listing" onClose={onClose}>
      <div className="space-y-4">
        <Field label="主图（用于视觉识别）">
          <ImageInput value={image} onChange={setImage} />
        </Field>
        <Field label="Listing Name（自己起的名字，不是 Etsy 标题）">
          <input
            className={inputCls}
            value={name}
            autoFocus
            placeholder="例如：美国店羊毛毡框"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Etsy URL（可选）">
          <input
            className={inputCls}
            value={url}
            placeholder="https://www.etsy.com/listing/..."
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field label="Notes（可选）">
          <textarea
            className={inputCls}
            rows={2}
            value={notes}
            placeholder="例如：新品测试 / 准备放广告 / 重点观察"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button loading={saving} onClick={save}>
            创建
          </Button>
        </div>
      </div>
    </Modal>
  )
}
