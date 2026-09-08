import type { GptImageModel } from './cost-utils';
import { getPresetDimensions, validateGptImage2Size, type SizePreset } from './size-utils';

export const IMAGE_MODELS: GptImageModel[] = [
    'gpt-image-2',
    'gpt-image-2-高质量4k',
    'agnes-image-2.5-flash',
    'agnes-image-2.1-flash',
    'gpt-image-1.5',
    'gpt-image-1',
    'gpt-image-1-mini'
];
export const MAX_EDIT_IMAGES = 10;
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export type ImageMode = 'generate' | 'edit';
export type StorageMode = 'fs' | 'indexeddb';
export type ImageSettings = {
    prompt: string;
    model: GptImageModel;
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: 'auto' | 'low' | 'medium' | 'high';
    output_format: 'png' | 'jpeg' | 'webp';
    output_compression: number;
    background: 'auto' | 'opaque' | 'transparent';
    moderation: 'auto' | 'low';
    stream: boolean;
    partial_images: 1 | 2 | 3;
};

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
    prompt: '',
    model: 'gpt-image-2',
    n: 1,
    size: 'auto',
    customWidth: 1024,
    customHeight: 1024,
    quality: 'auto',
    output_format: 'png',
    output_compression: 100,
    background: 'auto',
    moderation: 'auto',
    stream: false,
    partial_images: 2
};

export function normalizeImageSettings(raw: unknown): ImageSettings {
    const input = raw && typeof raw === 'object' ? (raw as Partial<ImageSettings>) : {};
    const value = { ...DEFAULT_IMAGE_SETTINGS };
    if (typeof input.prompt === 'string') value.prompt = input.prompt;
    if (IMAGE_MODELS.includes(input.model as GptImageModel)) value.model = input.model!;
    if (['auto', 'custom', 'square', 'landscape', 'portrait'].includes(input.size || '')) value.size = input.size!;
    if (['auto', 'low', 'medium', 'high'].includes(input.quality || '')) value.quality = input.quality!;
    if (['png', 'jpeg', 'webp'].includes(input.output_format || '')) value.output_format = input.output_format!;
    if (['auto', 'opaque', 'transparent'].includes(input.background || '')) value.background = input.background!;
    if (input.moderation === 'low') value.moderation = 'low';
    // 保留用户正在输入的尺寸，让校验提示错误，避免悄悄改成默认分辨率。
    if (typeof input.customWidth === 'number' && Number.isFinite(input.customWidth))
        value.customWidth = input.customWidth;
    if (typeof input.customHeight === 'number' && Number.isFinite(input.customHeight))
        value.customHeight = input.customHeight;
    const integer = (number: unknown, fallback: number) =>
        typeof number === 'number' && Number.isInteger(number) ? number : fallback;
    value.n = Math.max(1, Math.min(10, integer(input.n, value.n)));
    value.output_compression = Math.max(0, Math.min(100, integer(input.output_compression, value.output_compression)));
    value.partial_images = Math.max(1, Math.min(3, integer(input.partial_images, value.partial_images))) as 1 | 2 | 3;
    value.stream = input.stream === true && value.n === 1 && value.model === 'gpt-image-2';
    if (value.model !== 'gpt-image-2' && value.size === 'custom') value.size = 'auto';
    if (value.model === 'gpt-image-2' && value.background === 'transparent') value.background = 'auto';
    if (value.background === 'transparent' && value.output_format === 'jpeg') value.output_format = 'png';
    return value;
}

export function getRequestSize(settings: ImageSettings): string {
    return settings.size === 'custom'
        ? `${settings.customWidth}x${settings.customHeight}`
        : (getPresetDimensions(settings.size, settings.model) ?? settings.size);
}

export function validateSettings(settings: ImageSettings): string | null {
    if (!settings.prompt.trim()) return '请先描述你想要的画面或修改内容。';
    if (settings.size === 'custom') {
        const result = validateGptImage2Size(settings.customWidth, settings.customHeight);
        if (!result.valid) return result.reason;
    }
    return null;
}

export function selectImageFiles(existing: File[], incoming: File[], max = MAX_EDIT_IMAGES) {
    const accepted: File[] = [];
    const messages: string[] = [];
    for (const file of incoming) {
        if (!IMAGE_MIME_TYPES.includes(file.type)) {
            messages.push(`${file.name}：仅支持 PNG、JPEG 和 WebP。`);
        } else if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
            messages.push(`${file.name}：图片不能为空，且每张需小于 50 MB。`);
        } else if (
            [...existing, ...accepted].some(
                (item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
            )
        ) {
            messages.push(`${file.name} 已添加。`);
        } else if (existing.length + accepted.length >= max) {
            messages.push(`最多添加 ${max} 张图片，超出的图片未添加。`);
            break;
        } else {
            accepted.push(file);
        }
    }
    return { accepted, message: messages.join(' ') };
}
