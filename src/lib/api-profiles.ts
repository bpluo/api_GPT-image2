import { normalizeApiBaseUrl } from './api-config';

export type ApiProfile = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
};

export type ProfileStore = {
    version: 1;
    activeId: string | null;
    profiles: ApiProfile[];
};

const STORE_KEY = 'apiProfiles.v1';
const LEGACY_KEY = 'apiSettings';
export const MAX_PROFILES = 8;

export function createProfileId(): string {
    return globalThis.crypto?.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeProfileName(raw: unknown, fallbackIndex: number): string {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed) return `配置 ${fallbackIndex}`;
    return trimmed.slice(0, 30);
}

export function normalizeProfile(raw: unknown, fallbackIndex: number): ApiProfile | null {
    if (!raw || typeof raw !== 'object') return null;
    const input = raw as { id?: unknown; name?: unknown; baseUrl?: unknown; apiKey?: unknown };
    const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
    if (!apiKey) return null;
    let baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim() : '';
    if (baseUrl) {
        try {
            baseUrl = normalizeApiBaseUrl(baseUrl);
        } catch {
            return null; // keep storage clean: drop profiles with broken URLs
        }
    }
    const id = typeof input.id === 'string' && input.id ? input.id : createProfileId();
    return { id, name: normalizeProfileName(input.name, fallbackIndex), baseUrl, apiKey };
}

export function normalizeStore(raw: unknown): ProfileStore {
    const store: ProfileStore = { version: 1, activeId: null, profiles: [] };
    if (!raw || typeof raw !== 'object') return store;
    const input = raw as { activeId?: unknown; profiles?: unknown };
    const profiles = Array.isArray(input.profiles)
        ? input.profiles
              .map((profile, index) => normalizeProfile(profile, index + 1))
              .filter((profile): profile is ApiProfile => profile !== null)
              .slice(0, MAX_PROFILES)
        : [];
    // Deduplicate ids so React keys stay stable.
    const seen = new Set<string>();
    const unique = profiles.map((profile) => {
        let id = profile.id;
        while (seen.has(id)) id = `${id}-${createProfileId().slice(0, 4)}`;
        seen.add(id);
        return { ...profile, id };
    });
    const activeId =
        typeof input.activeId === 'string' && unique.some((profile) => profile.id === input.activeId)
            ? input.activeId
            : (unique[0]?.id ?? null);
    return { version: 1, activeId, profiles: unique };
}

/** Reads the profile store, migrating the legacy single apiSettings entry. */
export function loadProfileStore(storage: Pick<Storage, 'getItem'> = localStorage): ProfileStore {
    let raw: string | null = null;
    try {
        raw = storage.getItem(STORE_KEY);
    } catch {
        // Storage unavailable — caller decides how to surface the error.
    }
    if (raw) {
        try {
            return normalizeStore(JSON.parse(raw));
        } catch {
            // Corrupted store falls through to legacy migration, which may still find the old key.
        }
    }
    try {
        const legacy = storage.getItem(LEGACY_KEY);
        if (legacy) {
            const saved = JSON.parse(legacy);
            const apiKey = typeof saved.apiKey === 'string' ? saved.apiKey.trim() : '';
            const baseUrl = typeof saved.baseUrl === 'string' ? saved.baseUrl.trim() : '';
            if (apiKey) {
                const migrated = normalizeStore({
                    profiles: [{ name: hostLabel(baseUrl), baseUrl, apiKey }]
                });
                if (migrated.profiles.length) return migrated;
            }
        }
    } catch {
        // Legacy data unusable — start fresh.
    }
    return { version: 1, activeId: null, profiles: [] };
}

export function hostLabel(baseUrl: string): string {
    if (!baseUrl) return 'OpenAI 官方';
    try {
        return new URL(baseUrl).host;
    } catch {
        return '自定义接口';
    }
}

export function saveProfileStore(store: ProfileStore, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
    try {
        storage.setItem(STORE_KEY, JSON.stringify(store));
        return true;
    } catch {
        return false;
    }
}

export function activeProfile(store: ProfileStore): ApiProfile | null {
    return store.profiles.find((profile) => profile.id === store.activeId) || null;
}

export function profileCredentials(store: ProfileStore): { apiKey: string; baseUrl: string } {
    const profile = activeProfile(store);
    return profile ? { apiKey: profile.apiKey, baseUrl: profile.baseUrl } : { apiKey: '', baseUrl: '' };
}

/** Fetches the model list for a profile (or the server config when no profile). */
export async function fetchModelList(credentials: { apiKey: string; baseUrl: string }): Promise<string[]> {
    const response = await fetch('/api/models', {
        headers: {
            ...(credentials.apiKey ? { 'X-Api-Key': credentials.apiKey } : {}),
            ...(credentials.baseUrl ? { 'X-Base-Url': credentials.baseUrl } : {})
        },
        signal: AbortSignal.timeout(20000),
        cache: 'no-store'
    });
    const result = (await response.json().catch(() => null)) as { models?: string[]; error?: string } | null;
    if (!response.ok || !result?.models) {
        throw new Error(result?.error || '模型列表获取失败，可手动输入模型名。');
    }
    return result.models;
}
