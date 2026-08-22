import { getSettings } from './settings'
import type {
  AdsExtract,
  OrganicExtract,
  FavoritesExtract,
  ActionSummary
} from '../shared/types'

interface ChatMessage {
  role: 'system' | 'user'
  content: string | Array<Record<string, unknown>>
}

async function chat(
  messages: ChatMessage[],
  opts: { vision?: boolean; json?: boolean } = {}
): Promise<string> {
  const s = getSettings()
  if (!s.apiKey) throw new Error('尚未设置 API Key，请到 Settings 页面填写。')
  const model = opts.vision ? s.visionModel || s.model : s.model
  const base = s.baseUrl.replace(/\/$/, '')

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.1
  }
  if (opts.json) body.response_format = { type: 'json_object' }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AI 接口错误 ${res.status}: ${text.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 返回为空。')
  return content
}

function parseJson<T>(raw: string): T {
  // 兼容模型偶尔包裹 ```json ``` 或前后有解释文字的情况
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1)
  return JSON.parse(text) as T
}

function visionMessages(system: string, instruction: string, imageDataUrl: string): ChatMessage[] {
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: instruction },
        { type: 'image_url', image_url: { url: imageDataUrl } }
      ]
    }
  ]
}

export async function extractAds(imageDataUrl: string): Promise<AdsExtract> {
  const raw = await chat(
    visionMessages(
      '你是一个数据识别助手，只输出 JSON。',
      `这是一张 Etsy Ads（广告）后台截图。请识别其中的数据，输出 JSON，字段：
{"date_range": string, "views": number, "clicks": number, "orders": number, "revenue": number, "spend": number, "roas": number}
规则：
- 数字去掉货币符号和千分位逗号。
- 例如 "378.7K" 转成 378700；"21,454.16" 转成 21454.16。
- 识别不到的字段填 null。
- 只输出 JSON，不要解释。`,
      imageDataUrl
    ),
    { vision: true, json: true }
  )
  return parseJson<AdsExtract>(raw)
}

export async function extractOrganic(imageDataUrl: string): Promise<OrganicExtract> {
  const raw = await chat(
    visionMessages(
      '你是一个数据识别助手，只输出 JSON。',
      `这是一张 Etsy Listing Stats（自然流量统计）截图。请识别数据，输出 JSON，字段：
{"visits": number, "items_sold": number, "revenue": number}
规则：数字去掉符号和逗号；"14.1K" 转成 14100；识别不到填 null；只输出 JSON。`,
      imageDataUrl
    ),
    { vision: true, json: true }
  )
  return parseJson<OrganicExtract>(raw)
}

export async function extractFavorites(imageDataUrl: string): Promise<FavoritesExtract> {
  const raw = await chat(
    visionMessages(
      '你是一个数据识别助手，只输出 JSON。',
      `这是一张 Etsy 收藏(Favorites)截图。识别收藏数，输出 JSON：{"favorites": number}。识别不到填 null；只输出 JSON。`,
      imageDataUrl
    ),
    { vision: true, json: true }
  )
  return parseJson<FavoritesExtract>(raw)
}

export async function summarizeAction(rawText: string): Promise<ActionSummary> {
  const raw = await chat(
    [
      {
        role: 'system',
        content: '你是运营助手，帮卖家把大白话运营动作整理成结构化 JSON，只输出 JSON。'
      },
      {
        role: 'user',
        content: `卖家用大白话描述了今天对某个 Etsy Listing 做的运营动作：
"""${rawText}"""

请整理成 JSON，字段：
{
  "type": "Price | Ads | Image | Title | Variation | Other 之一",
  "action": "简短动作标题（英文或中文均可）",
  "details": "具体做了什么",
  "before": "改动前的值（如价格 44.99），没有则 null",
  "after": "改动后的值（如 39.99），没有则 null",
  "reason": "为什么这么做",
  "review_days": 数字，建议几天后复盘（如 3），无法判断填 3
}
只输出 JSON。`
      }
    ],
    { json: true }
  )
  return parseJson<ActionSummary>(raw)
}

export async function summarizeListing(context: string): Promise<string> {
  return chat([
    {
      role: 'system',
      content:
        '你是资深 Etsy 运营复盘助手。基于卖家提供的历史 Snapshot 数据和运营动作，做简洁中文复盘。'
    },
    {
      role: 'user',
      content: `以下是某个 Etsy Listing 的历史数据与运营动作记录：

${context}

请输出一份简洁的复盘，用清晰的小标题分段，包含：
1. 当前趋势（上涨/下降/持平）
2. 有效动作
3. 无效动作
4. 风险
5. 建议
注意：你只是辅助，最终判断由卖家完成。不要编造数据里没有的信息。`
    }
  ])
}

export async function listModels(override?: {
  baseUrl?: string
  apiKey?: string
}): Promise<string[]> {
  const s = getSettings()
  const base = (override?.baseUrl ?? s.baseUrl).replace(/\/$/, '')
  const apiKey = override?.apiKey ?? s.apiKey
  if (!base) throw new Error('请先填写 API Base URL。')
  if (!apiKey) throw new Error('请先填写 API Key。')

  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`获取模型列表失败 ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    data?: Array<string | { id?: string; model?: string; name?: string }>
    models?: Array<string | { id?: string; model?: string; name?: string }>
  }
  const raw = data.data ?? data.models ?? []
  const ids = raw
    .map((m) => (typeof m === 'string' ? m : m.id || m.model || m.name || ''))
    .filter((x): x is string => !!x)
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
}

export async function testConnection(): Promise<string> {
  const raw = await chat([
    { role: 'system', content: '只回复 OK。' },
    { role: 'user', content: '连通性测试，请只回复 OK。' }
  ])
  return raw.trim()
}
