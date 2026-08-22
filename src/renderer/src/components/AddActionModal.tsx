import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Modal, Field, Button, inputCls } from './ui'
import { MultiImageInput } from './MultiImageInput'
import { useToast } from './Toast'
import { addDays, today } from '../lib/format'
import type { ActionType } from '../../../shared/types'

const TYPES: ActionType[] = ['Price', 'Ads', 'Image', 'Title', 'Variation', 'Other']

export function AddActionModal({
  listingId,
  onClose,
  onSaved
}: {
  listingId: number
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const toast = useToast()
  const [date, setDate] = useState(today())
  const [raw, setRaw] = useState('')
  const [type, setType] = useState<ActionType>('Other')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [before, setBefore] = useState('')
  const [after, setAfter] = useState('')
  const [reason, setReason] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [organizing, setOrganizing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function organize(): Promise<void> {
    if (!raw.trim()) return toast('请先输入今天做了什么', 'error')
    setOrganizing(true)
    try {
      const r = await window.api.ai.summarizeAction(raw.trim())
      setType(r.type || 'Other')
      setTitle(r.action || '')
      setDetails(r.details || '')
      setBefore(r.before || '')
      setAfter(r.after || '')
      setReason(r.reason || '')
      setReviewDate(addDays(date, r.review_days ?? 3))
      toast('AI 已整理，请核对', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setOrganizing(false)
    }
  }

  async function save(): Promise<void> {
    if (!raw.trim() && !title.trim()) return toast('请输入动作内容', 'error')
    setSaving(true)
    const ai_summary = [
      title && `Action: ${title}`,
      details && `Details: ${details}`,
      reason && `Reason: ${reason}`,
      reviewDate && `Review: ${reviewDate}`
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await window.api.actions.create({
        listing_id: listingId,
        date,
        raw_text: raw.trim(),
        ai_summary: ai_summary || null,
        type,
        before: before.trim() || null,
        after: after.trim() || null,
        reason: reason.trim() || null,
        review_date: reviewDate || null,
        effect: null,
        conclusion: null,
        images: null,
        imageDataUrls: images
      })
      toast('已保存运营动作', 'success')
      onSaved()
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="记录运营动作" onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="日期">
            <input className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="今天做了什么？（大白话即可）">
            <textarea
              className={inputCls}
              rows={6}
              autoFocus
              placeholder="例如：今天把广告改成最大曝光，因为最近订单不错。"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
          </Field>
          <Button variant="subtle" loading={organizing} onClick={organize} className="w-full">
            <Sparkles size={14} /> AI 整理
          </Button>
          <Field label="配图（可选：换主图 / 改图等，可粘贴多张）">
            <MultiImageInput value={images} onChange={setImages} />
          </Field>
        </div>

        <div className="space-y-3 rounded-xl border border-black/5 bg-black/[0.015] p-4">
          <p className="text-sm font-semibold">整理结果（可修改）</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="类型">
              <select
                className={inputCls}
                value={type}
                onChange={(e) => setType(e.target.value as ActionType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="复盘日期">
              <input
                className={inputCls}
                value={reviewDate}
                placeholder="YYYY-MM-DD"
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="动作标题">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="详情">
            <textarea
              className={inputCls}
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Before">
              <input className={inputCls} value={before} onChange={(e) => setBefore(e.target.value)} />
            </Field>
            <Field label="After">
              <input className={inputCls} value={after} onChange={(e) => setAfter(e.target.value)} />
            </Field>
          </div>
          <Field label="原因">
            <textarea
              className={inputCls}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button loading={saving} onClick={save}>
          保存动作
        </Button>
      </div>
    </Modal>
  )
}
