import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { getDataDir } from './db'
import type { AiSettings, GithubConfig } from '../shared/types'

const AI_DEFAULTS: AiSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  visionModel: 'gpt-4o'
}

const GITHUB_DEFAULTS: GithubConfig = {
  clientId: '',
  token: '',
  user: '',
  repo: 'etsy-tracker-data',
  lastSync: ''
}

function settingsPath(): string {
  return join(getDataDir(), 'settings.json')
}

// AI 设置存在文件根层（兼容旧版本）；GitHub 配置存在 github 键下。
function readAll(): Record<string, unknown> {
  try {
    if (existsSync(settingsPath())) {
      return JSON.parse(readFileSync(settingsPath(), 'utf-8'))
    }
  } catch {
    /* 忽略损坏配置 */
  }
  return {}
}

function writeAll(obj: Record<string, unknown>): void {
  writeFileSync(settingsPath(), JSON.stringify(obj, null, 2))
}

export function getSettings(): AiSettings {
  const all = readAll()
  return {
    baseUrl: (all.baseUrl as string) ?? AI_DEFAULTS.baseUrl,
    apiKey: (all.apiKey as string) ?? AI_DEFAULTS.apiKey,
    model: (all.model as string) ?? AI_DEFAULTS.model,
    visionModel: (all.visionModel as string) ?? AI_DEFAULTS.visionModel
  }
}

export function saveSettings(s: AiSettings): AiSettings {
  const all = readAll()
  writeAll({ ...all, ...s })
  return getSettings()
}

export function getGithub(): GithubConfig {
  const all = readAll()
  const g = (all.github as Partial<GithubConfig>) || {}
  return { ...GITHUB_DEFAULTS, ...g }
}

export function saveGithub(patch: Partial<GithubConfig>): GithubConfig {
  const all = readAll()
  const merged = { ...GITHUB_DEFAULTS, ...(all.github as object), ...patch }
  writeAll({ ...all, github: merged })
  return getGithub()
}
