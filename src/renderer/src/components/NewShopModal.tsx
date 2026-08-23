import { useState } from 'react'
import { Modal, Field, Button, inputCls } from './ui'
import { useToast } from './Toast'

export function NewShopModal({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: () => void
}): JSX.Element {
  const toast = useToast()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(): Promise<void> {
    if (!name.trim()) {
      toast('请填写店铺名', 'error')
      return
    }
    setSaving(true)
    try {
      await window.api.shops.create({ name: name.trim(), notes: notes.trim() || null })
      toast('已创建店铺', 'success')
      onCreated()
      onClose()
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="新建店铺" onClose={onClose}>
      <div className="space-y-4">
        <Field label="店铺名（自己起，用于区分多店）">
          <input
            className={inputCls}
            value={name}
            autoFocus
            placeholder="例如：美国店 UWS / 英国店 …"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="备注（可选）">
          <textarea
            className={inputCls}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
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
