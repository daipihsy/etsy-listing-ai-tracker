import { contextBridge, ipcRenderer } from 'electron'
import type {
  Listing,
  Snapshot,
  Action,
  AiSettings,
  AdsExtract,
  OrganicExtract,
  FavoritesExtract,
  ActionSummary,
  ListingInput,
  SnapshotInput,
  ActionInput
} from '../shared/types'

type ListingWithLatest = Listing & {
  latest_snapshot: Snapshot | null
  last_action: Action | null
}

const api = {
  listings: {
    list: (): Promise<ListingWithLatest[]> => ipcRenderer.invoke('listings:list'),
    get: (id: number): Promise<Listing | null> => ipcRenderer.invoke('listings:get', id),
    create: (input: ListingInput): Promise<Listing> => ipcRenderer.invoke('listings:create', input),
    update: (
      id: number,
      patch: Partial<Listing> & { imageDataUrl?: string | null }
    ): Promise<Listing> => ipcRenderer.invoke('listings:update', id, patch),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('listings:delete', id)
  },
  snapshots: {
    list: (listingId: number): Promise<Snapshot[]> =>
      ipcRenderer.invoke('snapshots:list', listingId),
    create: (
      input: Omit<SnapshotInput, 'original_images'> & { imageDataUrls?: string[] }
    ): Promise<Snapshot> => ipcRenderer.invoke('snapshots:create', input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('snapshots:delete', id)
  },
  actions: {
    list: (listingId: number): Promise<Action[]> => ipcRenderer.invoke('actions:list', listingId),
    create: (input: ActionInput): Promise<Action> => ipcRenderer.invoke('actions:create', input),
    update: (id: number, patch: Partial<Action>): Promise<Action> =>
      ipcRenderer.invoke('actions:update', id, patch),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('actions:delete', id)
  },
  ai: {
    extractAds: (dataUrl: string): Promise<AdsExtract> =>
      ipcRenderer.invoke('ai:extractAds', dataUrl),
    extractOrganic: (dataUrl: string): Promise<OrganicExtract> =>
      ipcRenderer.invoke('ai:extractOrganic', dataUrl),
    extractFavorites: (dataUrl: string): Promise<FavoritesExtract> =>
      ipcRenderer.invoke('ai:extractFavorites', dataUrl),
    summarizeAction: (raw: string): Promise<ActionSummary> =>
      ipcRenderer.invoke('ai:summarizeAction', raw),
    summarizeListing: (ctx: string): Promise<string> =>
      ipcRenderer.invoke('ai:summarizeListing', ctx),
    test: (): Promise<string> => ipcRenderer.invoke('ai:test'),
    listModels: (override?: { baseUrl?: string; apiKey?: string }): Promise<string[]> =>
      ipcRenderer.invoke('ai:listModels', override)
  },
  settings: {
    get: (): Promise<AiSettings> => ipcRenderer.invoke('settings:get'),
    save: (s: AiSettings): Promise<AiSettings> => ipcRenderer.invoke('settings:save', s)
  },
  image: {
    dataUrl: (filename: string): Promise<string | null> =>
      ipcRenderer.invoke('image:dataUrl', filename)
  },
  clipboard: {
    image: (): Promise<string | null> => ipcRenderer.invoke('clipboard:image')
  },
  backup: {
    export: (): Promise<{ ok: boolean; filePath?: string }> => ipcRenderer.invoke('backup:export'),
    import: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('backup:import'),
    dataDir: (): Promise<string> => ipcRenderer.invoke('backup:dataDir')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
