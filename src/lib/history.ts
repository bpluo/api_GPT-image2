import type { CostDetails, GptImageModel } from './cost-utils';
import { normalizeImageSettings, type ImageMode, type ImageSettings, type StorageMode } from './image-settings';

export type HistoryMetadata = {
    id: string;
    sessionId?: string;
    parentId?: string;
    sourceImageFilenames?: string[];
    coverImageFilename?: string;
    timestamp: number;
    images: { filename: string }[];
    storageModeUsed: StorageMode;
    durationMs: number;
    prompt: string;
    mode: ImageMode;
    costDetails: CostDetails | null;
    quality: ImageSettings['quality'];
    background: ImageSettings['background'];
    moderation: ImageSettings['moderation'];
    output_format?: ImageSettings['output_format'];
    model?: GptImageModel;
    settings?: ImageSettings;
    presetTitle?: string;
    presetId?: string;
    presetCategory?: string;
    presetTags?: string[];
};

export function normalizeHistory(raw: unknown): HistoryMetadata[] {
    if (!Array.isArray(raw)) throw new Error('历史记录格式无效，原始记录已保留。');
    const ids = new Set<string>();
    return raw
        .flatMap((value, index) => {
            if (!value || typeof value !== 'object' || !Array.isArray(value.images)) return [];
            const images: { filename: string }[] = value.images.filter(
                (image: { filename?: unknown } | null) =>
                    image &&
                    typeof image.filename === 'string' &&
                    /^[\w.-]+\.(png|jpe?g|webp)$/i.test(image.filename) &&
                    !image.filename.includes('..')
            );
            if (!images.length) return [];
            const timestamp =
                Number.isFinite(value.timestamp) && Math.abs(value.timestamp) <= 8.64e15 ? value.timestamp : 0;
            let id = typeof value.id === 'string' && value.id ? value.id : `legacy-${timestamp}-${images[0].filename}`;
            while (ids.has(id)) id = `${id}-${index}`;
            ids.add(id);
            const settings = normalizeImageSettings(value.settings || value);
            const cost = value.costDetails;
            const validCost =
                cost &&
                ['estimated_cost_usd', 'text_input_tokens', 'image_input_tokens', 'image_output_tokens'].every(
                    (key) => typeof cost[key] === 'number' && Number.isFinite(cost[key]) && cost[key] >= 0
                );
            return [
                {
                    ...value,
                    id,
                    timestamp,
                    images,
                    prompt: typeof value.prompt === 'string' ? value.prompt : '',
                    mode: value.mode === 'edit' ? 'edit' : 'generate',
                    durationMs: Number.isFinite(value.durationMs) && value.durationMs >= 0 ? value.durationMs : 0,
                    storageModeUsed: value.storageModeUsed === 'indexeddb' ? 'indexeddb' : 'fs',
                    quality: settings.quality,
                    background: settings.background,
                    moderation: settings.moderation,
                    model: settings.model,
                    output_format: settings.output_format,
                    settings: value.settings ? settings : undefined,
                    costDetails: validCost ? cost : null,
                    sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
                    parentId: typeof value.parentId === 'string' ? value.parentId : undefined,
                    sourceImageFilenames: Array.isArray(value.sourceImageFilenames)
                        ? value.sourceImageFilenames.filter((name: unknown) => typeof name === 'string')
                        : [],
                    coverImageFilename: images.some((image) => image.filename === value.coverImageFilename)
                        ? value.coverImageFilename
                        : images[0].filename,
                    presetTitle: typeof value.presetTitle === 'string' ? value.presetTitle : undefined,
                    presetId: typeof value.presetId === 'string' ? value.presetId : undefined,
                    presetCategory: typeof value.presetCategory === 'string' ? value.presetCategory : undefined,
                    presetTags: Array.isArray(value.presetTags)
                        ? value.presetTags.filter((tag: unknown) => typeof tag === 'string')
                        : undefined
                } as HistoryMetadata
            ];
        })
        .sort((a, b) => b.timestamp - a.timestamp);
}

export const imageStorageKey = (mode: StorageMode, filename: string) => `${mode}:${filename}`;

export function planHistoryDeletion(history: HistoryMetadata[], ids: Set<string>) {
    const retained = new Set(
        history
            .filter((item) => !ids.has(item.id))
            .flatMap((item) => item.images.map((image) => imageStorageKey(item.storageModeUsed, image.filename)))
    );
    // 旧记录未记录源图的存储位置，保守保留两种存储中仍被引用的源图。
    history
        .filter((item) => !ids.has(item.id))
        .forEach((item) =>
            item.sourceImageFilenames?.forEach((filename) => {
                retained.add(imageStorageKey('fs', filename));
                retained.add(imageStorageKey('indexeddb', filename));
            })
        );
    const files = new Map<string, { filename: string; storageMode: StorageMode }>();
    const shared = new Set<string>();
    for (const item of history.filter((entry) => ids.has(entry.id))) {
        for (const image of item.images) {
            const key = imageStorageKey(item.storageModeUsed, image.filename);
            if (retained.has(key)) shared.add(key);
            else files.set(key, { filename: image.filename, storageMode: item.storageModeUsed });
        }
    }
    return { files: [...files.values()], shared };
}

export function applyHistoryDeletion(history: HistoryMetadata[], ids: Set<string>, removed: Set<string>) {
    return history.flatMap((item) => {
        if (!ids.has(item.id)) return [item];
        const images = item.images.filter(
            (image) => !removed.has(imageStorageKey(item.storageModeUsed, image.filename))
        );
        return images.length ? [{ ...item, images, coverImageFilename: images[0].filename }] : [];
    });
}

export function groupHistoryBySession(items: HistoryMetadata[]) {
    const sessions = new Map<string, { id: string; items: HistoryMetadata[]; endTimestamp: number }>();
    const itemSessions = new Map<string, string>();
    const imageSessions = new Map<string, string>();
    for (const item of [...items].sort((a, b) => a.timestamp - b.timestamp)) {
        const sourceSession = (item.sourceImageFilenames || [])
            .map((name) => imageSessions.get(imageStorageKey(item.storageModeUsed, name)))
            .find(Boolean);
        const sessionId =
            item.sessionId || (item.parentId && itemSessions.get(item.parentId)) || sourceSession || item.id;
        const session = sessions.get(sessionId) || { id: sessionId, items: [], endTimestamp: item.timestamp };
        session.items.push(item);
        session.endTimestamp = Math.max(session.endTimestamp, item.timestamp);
        sessions.set(sessionId, session);
        itemSessions.set(item.id, sessionId);
        item.images.forEach((image) =>
            imageSessions.set(imageStorageKey(item.storageModeUsed, image.filename), sessionId)
        );
    }
    return [...sessions.values()].sort((a, b) => b.endTimestamp - a.endTimestamp);
}
