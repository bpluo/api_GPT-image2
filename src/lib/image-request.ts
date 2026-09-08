import type { ApiUsage } from './cost-utils';
import {
    getRequestSize,
    validateSettings,
    type ImageMode,
    type ImageSettings,
    type StorageMode
} from './image-settings';

export type ImageRequest = {
    mode: ImageMode;
    settings: ImageSettings;
    imageFiles?: File[];
    maskFile?: File | null;
};
export type ApiImage = { filename: string; output_format: string; path?: string; b64_json?: string };
export type ImageResult = { images: ApiImage[]; usage?: ApiUsage; storageMode?: StorageMode; warning?: string };
export type ApiCredentials = { apiKey?: string; baseUrl?: string; passwordHash?: string | null };

export class ImageRequestError extends Error {
    constructor(
        message: string,
        public code = 'REQUEST_ERROR',
        public status?: number
    ) {
        super(message);
    }
}

export function buildImageFormData(request: ImageRequest, passwordHash?: string | null) {
    const { mode, settings } = request;
    const validation = validateSettings(settings);
    if (validation) throw new ImageRequestError(validation, 'VALIDATION_ERROR');
    if (mode === 'edit' && !request.imageFiles?.length)
        throw new ImageRequestError('请先添加要编辑的图片。', 'VALIDATION_ERROR');
    const body = new FormData();
    body.set('mode', mode);
    body.set('model', settings.model);
    body.set('prompt', settings.prompt.trim());
    body.set('n', String(settings.n));
    body.set('size', getRequestSize(settings));
    body.set('quality', settings.quality);
    if (passwordHash) body.set('passwordHash', passwordHash);
    if (settings.stream && settings.model === 'gpt-image-2' && settings.n === 1) {
        body.set('stream', 'true');
        body.set('partial_images', String(settings.partial_images));
    }
    if (mode === 'generate') {
        body.set('output_format', settings.output_format);
        body.set('background', settings.background);
        body.set('moderation', settings.moderation);
        if (settings.output_format !== 'png') body.set('output_compression', String(settings.output_compression));
    } else {
        request.imageFiles!.forEach((file, index) => body.set(`image_${index}`, file, file.name));
        if (request.maskFile) body.set('mask', request.maskFile, request.maskFile.name);
    }
    return body;
}

function parseResult(value: unknown): ImageResult {
    if (
        !value ||
        typeof value !== 'object' ||
        !('images' in value) ||
        !Array.isArray(value.images) ||
        value.images.length === 0
    ) {
        throw new ImageRequestError('接口未返回可用图片，请检查模型配置后重试。', 'EMPTY_RESULT');
    }
    if (
        value.images.some((image) => !image || typeof image.filename !== 'string' || (!image.path && !image.b64_json))
    ) {
        throw new ImageRequestError('返回的图片数据不完整，请重试。', 'INVALID_RESULT');
    }
    return value as ImageResult;
}

export async function consumeImageStream(
    response: Response,
    onPreview: (index: number, url: string) => void
): Promise<ImageResult> {
    if (!response.body) throw new ImageRequestError('图片响应为空，请重试。', 'EMPTY_STREAM');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const handleEvent = (block: string): ImageResult | undefined => {
        const data = block
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
        if (!data || data === '[DONE]') return;
        let event;
        try {
            event = JSON.parse(data);
        } catch {
            throw new ImageRequestError('图片响应格式异常，请重试。', 'INVALID_STREAM');
        }
        if (!event || typeof event !== 'object') return;
        if (event.type === 'error')
            throw new ImageRequestError(event.error || '生成中断，请重试。', event.code || 'STREAM_ERROR');
        if (event.type === 'partial_image' && typeof event.b64_json === 'string' && event.b64_json) {
            const mime =
                event.output_format === 'jpeg'
                    ? 'image/jpeg'
                    : event.output_format === 'webp'
                      ? 'image/webp'
                      : 'image/png';
            onPreview(event.index ?? 0, `data:${mime};base64,${event.b64_json}`);
        }
        if (event.type === 'done') return parseResult(event);
    };
    try {
        while (true) {
            const { done, value } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            let separator;
            while ((separator = /\r?\n\r?\n/.exec(buffer))) {
                const event = buffer.slice(0, separator.index);
                buffer = buffer.slice(separator.index + separator[0].length);
                const result = handleEvent(event);
                if (result) return result;
            }
            if (done) {
                const result = handleEvent(buffer);
                if (result) return result;
                throw new ImageRequestError('连接已中断，未收到完整图片。请检查网络后重试。', 'INCOMPLETE_STREAM');
            }
        }
    } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}

export async function requestImages(
    request: ImageRequest,
    credentials: ApiCredentials,
    signal: AbortSignal,
    onPreview: (index: number, url: string) => void
) {
    let response: Response;
    try {
        response = await fetch('/api/images', {
            method: 'POST',
            signal,
            headers: {
                ...(credentials.apiKey ? { 'X-Api-Key': credentials.apiKey } : {}),
                ...(credentials.baseUrl ? { 'X-Base-Url': credentials.baseUrl } : {})
            },
            body: buildImageFormData(request, credentials.passwordHash)
        });
    } catch (error) {
        if (signal.aborted || error instanceof ImageRequestError) throw error;
        throw new ImageRequestError('网络连接失败，请检查网络后重试。提示词和已有结果已保留。', 'NETWORK_ERROR');
    }
    if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
        return consumeImageStream(response, onPreview);
    }
    let result;
    try {
        result = await response.json();
    } catch {
        throw new ImageRequestError(
            `服务暂时无法响应（${response.status}），请检查接口地址或稍后重试。`,
            'INVALID_RESPONSE',
            response.status
        );
    }
    if (!response.ok) {
        throw new ImageRequestError(
            result.error || `请求失败（${response.status}），请稍后重试。`,
            result.code,
            response.status
        );
    }
    return parseResult(result);
}
