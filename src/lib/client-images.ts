import { db, deleteStoredImages, getStoredImage } from './db';
import { imageStorageKey, planHistoryDeletion, type HistoryMetadata } from './history';
import { ImageRequestError, type ImageResult } from './image-request';
import type { StorageMode } from './image-settings';

export type DisplayImage = { filename: string; path: string };

export async function loadHistoryImages(item: HistoryMetadata): Promise<DisplayImage[]> {
    const images = await Promise.all(
        item.images.map(async ({ filename }) => {
            if (item.storageModeUsed === 'fs') return { filename, path: `/api/image/${encodeURIComponent(filename)}` };
            const record = await getStoredImage(filename).catch(() => undefined);
            return record?.blob ? { filename, path: URL.createObjectURL(record.blob) } : null;
        })
    );
    return images.filter((image): image is DisplayImage => !!image);
}

export async function persistImageResult(result: ImageResult, storageMode: StorageMode) {
    if (storageMode === 'fs') {
        const images = result.images.map((image) => {
            if (!image.path) throw new Error('接口没有返回已保存图片的地址。');
            return { filename: image.filename, path: image.path };
        });
        return { images, saved: true };
    }
    const records = result.images.map((image) => {
        if (!image.b64_json) throw new Error('接口没有返回图片内容，无法保存到浏览器。');
        const bytes = Uint8Array.from(atob(image.b64_json), (character) => character.charCodeAt(0));
        const mime =
            image.output_format === 'jpeg' ? 'image/jpeg' : image.output_format === 'webp' ? 'image/webp' : 'image/png';
        return { filename: image.filename, blob: new Blob([bytes], { type: mime }) };
    });
    let saved = true;
    try {
        await db.images.bulkPut(records);
    } catch {
        saved = false;
    }
    return {
        images: records.map((record) => ({ filename: record.filename, path: URL.createObjectURL(record.blob) })),
        saved
    };
}

export async function deleteHistoryFiles(history: HistoryMetadata[], ids: Set<string>, passwordHash?: string | null) {
    const plan = planHistoryDeletion(history, ids);
    const removed = new Set(plan.shared);
    const diskFiles = plan.files.filter((file) => file.storageMode === 'fs').map((file) => file.filename);
    let error: ImageRequestError | null = null;
    for (let offset = 0; offset < diskFiles.length; offset += 100) {
        const filenames = diskFiles.slice(offset, offset + 100);
        try {
            const response = await fetch('/api/image-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filenames, passwordHash }),
                signal: AbortSignal.timeout(30000)
            });
            const result = await response.json();
            if (!response.ok || !Array.isArray(result.results))
                throw new ImageRequestError(result.error || '删除请求失败，请稍后重试。', result.code, response.status);
            for (const entry of result.results) {
                if (entry.success && filenames.includes(entry.filename))
                    removed.add(imageStorageKey('fs', entry.filename));
            }
        } catch (cause) {
            error =
                cause instanceof ImageRequestError
                    ? cause
                    : new ImageRequestError('删除时连接中断，未完成的图片与记录已保留。');
            break;
        }
    }
    if (!error) {
        const localFiles = plan.files.filter((file) => file.storageMode === 'indexeddb').map((file) => file.filename);
        try {
            if (localFiles.length) await deleteStoredImages(localFiles);
            localFiles.forEach((filename) => removed.add(imageStorageKey('indexeddb', filename)));
        } catch {
            error = new ImageRequestError('部分浏览器图片未能删除，相关记录已保留。');
        }
    }
    const failed = plan.files.filter((file) => !removed.has(imageStorageKey(file.storageMode, file.filename))).length;
    if (failed && !error) error = new ImageRequestError(`${failed} 张图片未能删除，相关记录已保留，可以稍后重试。`);
    return { removed, error };
}
