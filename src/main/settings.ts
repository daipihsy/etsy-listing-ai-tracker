import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { getDataDir } from './db'
import type { AiSettings } from '../shared/types'

const DEFAULTS: AiSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  visionModel: 'gpt-4o'
}

function settingsPath(): string {
  return join(getDataDir(), 'settings.json')
}

export function getSettings(): AiSettings {
  try {
    if (existsSync(settingsPath())) {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(settingsPath(), 'utf-8')) }
    }
  } catch {
    // 忽略损坏的配置，回退默认值
  }
  return { ...DEFAULTS }
}

export function saveSettings(s: AiSettings): AiSettings {
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2))
  return getSettings()
}
