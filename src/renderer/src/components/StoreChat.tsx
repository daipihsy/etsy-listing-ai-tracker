import { useEffect, useRef, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { Button, Spinner, inputCls } from './ui'
import { useToast } from './Toast'
import type { StoreChat as StoreChatMsg } from '../../../shared/types'

export function StoreChat({
  shopId,
  buildContext
}: {
  shopId: number
  buildContext: () => string
}): JSX.Element {
  const toast = useToast()
  const [msgs, setMsgs] = useState<StoreChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function load(): Promise<void> {
    setMsgs(await window.api.storeChats.list(shopId))
  }
  useEffect(() => {
    load()
  }, [shopId])
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, sending])

  async function send(): Promise<void> {
    const text = input.trim()
    if (!text) return
    setInput('')
    // 乐观显示用户消息
    setMsgs((m) => [
      ...m,
      { id: -Date.now(), uid: '', shop_id: shopId, role: 'user', content: text, created_at: '' }
    ])
    setSending(true)
    try {
      await window.api.storeAi.chat(shopId, text, buildContext())
      await load()
    } catch (e) {
      toast(String(e), 'error')
      await load()
    } finally {
      setSending(false)
    }
  }

  async function clear(): Promise<void> {
    if (!confirm('清空与该店的对话记录？')) return
    await window.api.storeChats.clear(shopId)
    load()
  }

  return (
    <div className="flex h-[460px] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">AI 对话</h2>
        {msgs.length > 0 && (
          <button onClick={clear} className="inline-flex items-center gap-1 text-xs text-black/40 hover:text-red-500">
            <Trash2 size={12} /> 清空
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-black/5 bg-black/[0.015] p-3">
        {msgs.length === 0 && !sending && (
          <p className="mt-16 text-center text-sm text-black/35">
            基于本店数据随便问，例如：<br />“为什么这个月转化率下降了？”“广告预算该怎么调？”
          </p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ' +
                (m.role === 'user' ? 'bg-etsy text-white' : 'border border-black/10 bg-white text-ink')
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3.5 py-2 text-sm text-black/50">
              <Spinner size={13} /> 思考中…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-2 flex items-end gap-2">
        <textarea
          className={inputCls + ' resize-none'}
          rows={2}
          placeholder="问点什么…（Enter 发送，Shift+Enter 换行）"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <Button loading={sending} onClick={send} className="h-[42px]">
          <Send size={15} />
        </Button>
      </div>
    </div>
  )
}
