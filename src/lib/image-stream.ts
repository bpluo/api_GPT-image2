import type { ApiUsage } from './cost-utils';
import type { StorageMode } from './image-settings';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export type RelayStreamEvent = {
    type: string;
    partial_image_index?: number;
    b64_json?: string | null;
    usage?: ApiUsage;
    error?: string | { message?: string };
};
export type StreamedImageResult = { filename: string; b64_json?: string; path?: string; output_format: string };
export type StreamingEvent = {
    type: 'partial_image' | 'completed' | 'error' | 'done';
    index?: number;
    partial_image_index?: number;
    b64_json?: string;
    filename?: string;
    path?: string;
    output_format?: string;
    usage?: ApiUsage;
    images?: StreamedImageResult[];
    error?: string;
    code?: string;
    storageMode?: StorageMode;
    warning?: string;
};

export function createStreamingImageResponse(
    stream: AsyncIterable<RelayStreamEvent>,
    options: {
        outputDir: string;
        fileExtension: string;
        saveToDisk: boolean;
        filenamePrefix?: number;
        signal?: AbortSignal;
        onCancel?: () => void;
    }
): Response {
    const encoder = new TextEncoder();
    const prefix = `${options.filenamePrefix ?? Date.now()}-${crypto.randomUUID()}`;
    const storageMode: StorageMode = options.saveToDisk ? 'fs' : 'indexeddb';
    let cancelled = false;
    let readerCancelled = false;
    let finished = false;
    const cancel = () => {
        cancelled = true;
        options.onCancel?.();
    };
    const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
            const emit = (event: StreamingEvent) => {
                if (!cancelled && !finished) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };
            options.signal?.addEventListener('abort', cancel, { once: true });
            const images: StreamedImageResult[] = [];
            let usage: ApiUsage | undefined;
            try {
                if (options.signal?.aborted) {
                    cancel();
                    return;
                }
                for await (const event of stream) {
                    if (cancelled) break;
                    if (event.type === 'error' || event.type.endsWith('.error')) {
                        throw new Error(
                            typeof event.error === 'string'
                                ? event.error
                                : event.error?.message || '图像服务中断了生成，请稍后重试。'
                        );
                    }
                    if (event.type.endsWith('.partial_image') && event.b64_json) {
                        emit({
                            type: 'partial_image',
                            index: images.length,
                            b64_json: event.b64_json,
                            partial_image_index: event.partial_image_index,
                            output_format: options.fileExtension
                        });
                    } else if (event.type.endsWith('.completed')) {
                        if (!event.b64_json) throw new Error('图像服务返回了空图片，请检查模型配置。');
                        const filename = `${prefix}-${images.length}.${options.fileExtension}`;
                        if (options.saveToDisk) {
                            await fs.writeFile(
                                path.join(options.outputDir, filename),
                                Buffer.from(event.b64_json, 'base64')
                            );
                        }
                        images.push({
                            filename,
                            output_format: options.fileExtension,
                            ...(options.saveToDisk ? { path: `/api/image/${filename}` } : { b64_json: event.b64_json })
                        });
                        if (event.usage) usage = event.usage;
                    }
                }
                if (!cancelled) {
                    if (!images.length) throw new Error('连接已结束，但未收到完整图片，请重试。');
                    emit({ type: 'done', images, usage, storageMode });
                }
            } catch (error) {
                if (!cancelled && images.length) {
                    emit({
                        type: 'done',
                        images,
                        usage,
                        storageMode,
                        warning: '连接在图片完成后中断，已保留收到的完整结果。'
                    });
                } else if (!cancelled)
                    emit({
                        type: 'error',
                        error: error instanceof Error ? error.message : '生成失败，请重试。',
                        code: 'STREAM_ERROR'
                    });
            } finally {
                options.signal?.removeEventListener('abort', cancel);
                finished = true;
                if (!readerCancelled) controller.close();
            }
        },
        cancel() {
            readerCancelled = true;
            cancel();
            options.signal?.removeEventListener('abort', cancel);
        }
    });
    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
}
