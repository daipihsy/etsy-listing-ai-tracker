import { getSettings } from './settings'
import type {
  AdsExtract,
  OrganicExtract,
  FavoritesExtract,
  ActionSummary,
  StoreStatsExtract,
  StoreAdsExtract,
  SnapshotTextExtract,
  ChatMessage
} from '../shared/types'

interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

async function chat(
  messages: ChatMsg[],
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

function visionMessages(system: string, instruction: string, imageDataUrl: string): ChatMsg[] {
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

// 单链接 Snapshot：从粘贴的页面文本提取该 listing 的数据（广告/自然/收藏）
export async function extractSnapshotFromText(pageText: string): Promise<SnapshotTextExtract> {
  const raw = await chat(
    [
      { role: 'system', content: '你是数据提取助手，只输出 JSON。' },
      {
        role: 'user',
        content: `以下是某个 Etsy listing 相关页面「复制的纯文本」，可能来自：该 listing 的 Etsy Ads 广告数据、Listing Stats（自然流量）数据、或收藏数。请提取该 listing 这一期的数据，输出 JSON：
{"date_range": string,
 "views": number, "clicks": number, "orders": number, "revenue": number, "spend": number, "roas": number,
 "visits": number, "items_sold": number, "organic_revenue": number,
 "favorites": number}
说明：广告的 Revenue 放 revenue、自然流量的 Revenue 放 organic_revenue、自然的销量放 items_sold、自然的访问放 visits；
数字去掉货币前缀(US$/£/$/USD)和千分位逗号；"378.7K"→378700；找不到的字段填 null；只输出 JSON，不要解释。
文本：
"""${pageText.slice(0, 16000)}"""`
      }
    ],
    { json: true }
  )
  return parseJson<SnapshotTextExtract>(raw)
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

// ---------------- 整店分析 ----------------

export async function extractStoreStats(imageDataUrl: string): Promise<StoreStatsExtract> {
  const raw = await chat(
    visionMessages(
      '你是数据识别助手，只输出 JSON。',
      `这是 Etsy 店铺 Stats（整店统计）页面截图，可能含 Visits/Orders/Conversion rate/Revenue 以及 Shopper Stats（Item favorites/Shop follows/Reviews/Repeat buyers/Cities reached/Abandoned carts）。
输出 JSON，字段：
{"date_range": string, "visits": number, "orders": number, "conversion_rate": number, "revenue": number,
 "fav_items": number, "shop_follows": number, "reviews_count": number, "review_avg": number,
 "repeat_buyers": number, "cities_reached": number, "abandoned_carts": number}
规则：数字去符号和逗号；"20.1K"→20100；"$34,277.13"→34277.13；conversion_rate 用百分数值（如 3.4）；review_avg 取星级平均（如 4.7）；识别不到填 null；只输出 JSON。`,
      imageDataUrl
    ),
    { vision: true, json: true }
  )
  return parseJson<StoreStatsExtract>(raw)
}

function ctr(clicks?: number | null, views?: number | null): number | null {
  if (clicks == null || views == null || views === 0) return null
  return +((clicks / views) * 100).toFixed(2)
}

export async function extractStoreAds(imageDataUrl: string): Promise<StoreAdsExtract> {
  const raw = await chat(
    visionMessages(
      '你是数据识别助手，只输出 JSON，尽可能完整地识别表格里的每一行。',
      `这是 Etsy Ads（整店广告）页面截图。它通常包含：
(1) 顶部整店汇总：Views/Clicks/Orders/Revenue/Spend/ROAS（可能有 Click rate）；
(2) 下方一个表格，列出每个单独 listing 的广告数据（listing 标题、Views、Clicks、Click rate、Orders、Revenue、Spend、ROAS）。
请两部分都识别，输出 JSON：
{
 "date_range": string,
 "views": number, "clicks": number, "orders": number, "revenue": number, "spend": number, "roas": number, "click_rate": number,
 "listings": [
   {"name": "listing 标题（尽量完整，可截断）", "views": number, "clicks": number, "click_rate": number, "orders": number, "revenue": number, "spend": number, "roas": number}
 ]
}
规则：数字去货币符号和千分位逗号；"536.4K"→536400；"$21,184.23"→21184.23；click_rate 用百分数值（如 2.1）；
表格里能看到几行就抓几行，尽量全；识别不到的字段填 null；只输出 JSON，不要解释。`,
      imageDataUrl
    ),
    { vision: true, json: true }
  )
  const r = parseJson<StoreAdsExtract>(raw)
  // Click rate 图上没有就自己算（整店 + 每条链接）
  if (r.click_rate == null) r.click_rate = ctr(r.clicks, r.views)
  if (Array.isArray(r.listings)) {
    r.listings = r.listings.map((l) => ({
      ...l,
      click_rate: l.click_rate != null ? l.click_rate : ctr(l.clicks, l.views)
    }))
  }
  return r
}

// 兜底：把整页文本交给文本模型提取（当规则解析不适用于某些店铺布局时）
export async function extractStoreAdsFromText(pageText: string): Promise<StoreAdsExtract> {
  const raw = await chat(
    [
      { role: 'system', content: '你是数据提取助手，只输出 JSON。' },
      {
        role: 'user',
        content: `以下是 Etsy 广告页「整页复制」的纯文本。请提取整店广告汇总 + 每个 listing 的明细，输出 JSON：
{"date_range": string, "views": number, "clicks": number, "orders": number, "revenue": number, "spend": number, "roas": number, "click_rate": number,
 "listings":[{"name": string, "strategy": "Efficient spending/Greater visibility/Lower click cost 之一或原文", "views": number, "clicks": number, "click_rate": number, "orders": number, "revenue": number, "spend": number, "roas": number}]}
规则：数字去符号和逗号；K→千，M→百万；金额去掉 USD；click_rate 用百分数值；尽量抓全每一行；识别不到填 null；只输出 JSON。
文本：
"""${pageText.slice(0, 24000)}"""`
      }
    ],
    { json: true }
  )
  const r = parseJson<StoreAdsExtract>(raw)
  if (r.click_rate == null) r.click_rate = ctr(r.clicks, r.views)
  if (Array.isArray(r.listings)) {
    r.listings = r.listings.map((l) => ({
      ...l,
      click_rate: l.click_rate != null ? l.click_rate : ctr(l.clicks, l.views)
    }))
  }
  return r
}

export async function storeAdvice(context: string): Promise<string> {
  return chat([
    {
      role: 'system',
      content:
        '你是资深 Etsy 店铺运营顾问。要站在全局为卖家分析，不能只罗列数字。用中文、分点、结合具体数字给可执行建议。'
    },
    {
      role: 'user',
      content: `以下是某个 Etsy 店铺的整店数据：包含整店流量/广告/Shopper 快照、可能的每日广告序列，以及广告页里各单链接（listing）的明细。

${context}

请输出分析与优化建议，分为：
1. 现状判断（流量/转化/广告/复购等关键指标趋势）
2. 主要问题（结合数字指出）
3. 【单链接广告诊断与策略调整】逐条点评广告明细里的 listing（用标题指代），结合 ROAS、花费、订单、点击率，以及它「当前投放策略」（Efficient spending / Greater visibility / Lower click cost）给出可执行建议，例如：是否切换投放策略、加/降预算、暂停或关闭、还是靠改主图/改标题/改价来救。花费高且 ROAS 低或长期 0 单的重点提示止损；ROAS 高、花费低的建议加投；点击率低的多半是主图/标题问题。要有全局取舍（把预算从差的挪到好的）。
4. 整店层面的策略与优化动作（按优先级，含预算如何在链接间重新分配）
5. 需要重点关注的风险
不要编造数据里没有的信息；只点评数据中出现的 listing。`
    }
  ])
}

export async function storeChat(context: string, history: ChatMessage[]): Promise<string> {
  return chat([
    {
      role: 'system',
      content: `你是该 Etsy 卖家的整店运营分析助手。下面是该店铺的数据（整店快照、每日广告序列、以及广告页里各单链接的明细）。回答时务必结合这些具体数字，需要时可针对某个 listing 给出「关广告/继续开/怎么调」的建议。用中文，简洁务实，不编造数据里没有的信息。

${context}`
    },
    ...history.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content
    }))
  ])
}

export async function testConnection(): Promise<string> {
  const raw = await chat([
    { role: 'system', content: '只回复 OK。' },
    { role: 'user', content: '连通性测试，请只回复 OK。' }
  ])
  return raw.trim()
}
