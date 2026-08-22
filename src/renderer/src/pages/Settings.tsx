import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button, Field, inputCls } from '../components/ui'
import { Combobox } from '../components/Combobox'
import { useToast } from '../components/Toast'
import type { AiSettings } from '../../../shared/types'

// 名字里带这些关键词的模型，通常支持图片/视觉输入
const VISION_HINT =
  /(gpt-4o|gpt-4\.1|o1|o3|o4|vision|claude-3|claude-4|claude-opus|claude-sonnet|claude-haiku|gemini|qwen.*vl|qvq|llava|internvl|pixtral|llama-3\.2|grok.*vision|glm-4v|step-1v|yi-vision|minicpm-v|molmo|phi-3.*vision|phi-4.*vision)/i
const isVision = (id: string): boolean => VISION_HINT.test(id)

export function Settings(): JSX.Element {
  const toast = useToast()
  const [s, setS] = useState<AiSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [dataDir, setDataDir] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    window.api.settings.get().then((cfg) => {
      setS(cfg)
      // 已填 Key 时进入页面自动拉取一次模型列表
      if (cfg.apiKey && cfg.baseUrl) {
        setLoadingModels(true)
        window.api.ai
          .listModels({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey })
          .then(setModels)
          .catch(() => {})
          .finally(() => setLoadingModels(false))
      }
    })
    window.api.backup.dataDir().then(setDataDir)
  }, [])

  async function fetchModels(): Promise<void> {
    if (!s) return
    if (!s.apiKey || !s.baseUrl) {
      toast('请先填写 Base URL 和 API Key', 'error')
      return
    }
    setLoadingModels(true)
    try {
      const list = await window.api.ai.listModels({ baseUrl: s.baseUrl, apiKey: s.apiKey })
      setModels(list)
      toast(`获取到 ${list.length} 个模型`, 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setLoadingModels(false)
    }
  }

  if (!s) return <p className="p-8 text-black/40">加载中…</p>

  function set<K extends keyof AiSettings>(k: K, v: AiSettings[K]): void {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev))
  }

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await window.api.settings.save(s!)
      toast('已保存设置', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function test(): Promise<void> {
    setTesting(true)
    try {
      await window.api.settings.save(s!)
      const r = await window.api.ai.test()
      toast(`连接成功：${r}`, 'success')
    } catch (e) {
      toast(`连接失败：${e}`, 'error')
    } finally {
      setTesting(false)
    }
  }

  async function doExport(): Promise<void> {
    const r = await window.api.backup.export()
    if (r.ok) toast('已导出备份', 'success')
  }
  async function doImport(): Promise<void> {
    if (!confirm('导入将覆盖当前所有数据，确定继续？')) return
    const r = await window.api.backup.import()
    if (r.ok) toast('导入完成，请重新进入 Listings 查看', 'success')
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-4">
      <h1 className="mb-5 text-xl font-semibold">Settings</h1>

      <section className="mb-6 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold">AI API 配置</h2>
        <p className="mb-4 text-sm text-black/40">
          支持任意 OpenAI 兼容接口（OpenAI / Claude / Gemini / OpenRouter 等）。
        </p>
        <div className="space-y-4">
          <Field label="API Base URL" hint="例如 https://api.openai.com/v1 或 https://openrouter.ai/api/v1">
            <input
              className={inputCls}
              value={s.baseUrl}
              onChange={(e) => set('baseUrl', e.target.value)}
            />
          </Field>
          <Field label="API Key">
            <input
              className={inputCls}
              type="password"
              value={s.apiKey}
              placeholder="sk-..."
              onChange={(e) => set('apiKey', e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-xs text-black/45">
              {models.length > 0
                ? `已加载 ${models.length} 个模型 · 直接下拉选择`
                : '填好上面两项后点右侧按钮拉取该中转站的模型列表'}
            </span>
            <Button variant="subtle" loading={loadingModels} onClick={fetchModels}>
              <RefreshCw size={14} /> 获取模型
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Model（文字整理 / 复盘）">
              <Combobox
                value={s.model}
                onChange={(v) => set('model', v)}
                options={models}
                placeholder="选择模型…"
                emptyHint="点「获取模型」加载列表"
              />
            </Field>
            <Field label="Vision Model（图片识别 · ✨ 标记通常支持看图）">
              <Combobox
                value={s.visionModel}
                onChange={(v) => set('visionModel', v)}
                options={[...models].sort(
                  (a, b) => Number(isVision(b)) - Number(isVision(a)) || a.localeCompare(b)
                )}
                placeholder="选择视觉模型…"
                emptyHint="点「获取模型」加载列表"
                markStar={isVision}
              />
            </Field>
          </div>
          <div className="flex gap-2 pt-1">
            <Button loading={saving} onClick={save}>
              保存
            </Button>
            <Button variant="subtle" loading={testing} onClick={test}>
              测试连接
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold">数据备份</h2>
        <p className="mb-4 text-sm text-black/40">
          备份包含所有 Listing、Snapshot、Action、AI 总结及原始截图。
        </p>
        <div className="flex gap-2">
          <Button variant="subtle" onClick={doExport}>
            导出备份
          </Button>
          <Button variant="subtle" onClick={doImport}>
            导入备份
          </Button>
        </div>
        <p className="mt-4 break-all text-xs text-black/30">数据目录：{dataDir}</p>
      </section>
    </div>
  )
}
