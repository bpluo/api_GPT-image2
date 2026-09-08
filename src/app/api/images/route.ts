import { ApiConfigError, resolveApiCredentials } from '@/lib/api-config';
import type { GptImageModel } from '@/lib/cost-utils';
import { IMAGE_MODELS, IMAGE_MIME_TYPES, MAX_EDIT_IMAGES, MAX_IMAGE_BYTES } from '@/lib/image-settings';
import { ensurePrimaryImageDirExists, getPrimaryImageDir } from '@/lib/image-storage';
import { createStreamingImageResponse, type RelayStreamEvent } from '@/lib/image-stream';
import { createRelayClient, extractRelayError, fetchImageAsBase64 } from '@/lib/relay-api';
import { checkAppPassword, getStorageMode } from '@/lib/server-config';
import { validateGptImage2Size } from '@/lib/size-utils';
import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';

const invalid = (error: string) => NextResponse.json({ error, code: 'VALIDATION_ERROR' }, { status: 400 });

export async function POST(request: NextRequest) {
    try {
        let form: FormData;
        try {
            form = await request.formData();
        } catch {
            return invalid('请求内容无法读取，请重新提交。');
        }
        const authError = checkAppPassword(form.get('passwordHash'));
        if (authError) return NextResponse.json(authError, { status: 401 });
        const credentials = resolveApiCredentials(
            { apiKey: request.headers.get('x-api-key'), baseUrl: request.headers.get('x-base-url') },
            { apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_API_BASE_URL }
        );
        const mode = form.get('mode');
        const promptValue = form.get('prompt');
        const prompt = typeof promptValue === 'string' ? promptValue.trim() : '';
        if (mode !== 'generate' && mode !== 'edit') return invalid('请选择生成或编辑模式。');
        if (!prompt) return invalid('提示词不能为空，请描述画面或修改内容。');
        const model = String(form.get('model') || 'gpt-image-2') as GptImageModel;
        if (!IMAGE_MODELS.includes(model)) return invalid('不支持此模型，请从模型列表中重新选择。');
        const n = Number(form.get('n') || 1);
        if (!Number.isInteger(n) || n < 1 || n > 10) return invalid('每次生成的图片数量需为 1 至 10 张。');
        const quality = String(form.get('quality') || 'auto') as 'auto' | 'low' | 'medium' | 'high';
        if (!['auto', 'low', 'medium', 'high'].includes(quality)) return invalid('图像质量参数无效。');
        const size = String(form.get('size') || 'auto');
        if (size !== 'auto') {
            const match = /^(\d+)x(\d+)$/.exec(size);
            if (!match) return invalid('尺寸格式无效，请使用“宽x高”，例如 2048x2048。');
            if (model === 'gpt-image-2') {
                const validation = validateGptImage2Size(Number(match[1]), Number(match[2]));
                if (!validation.valid) return invalid(validation.reason);
            } else if (
                ['gpt-image-1', 'gpt-image-1.5', 'gpt-image-1-mini'].includes(model) &&
                !['1024x1024', '1536x1024', '1024x1536'].includes(size)
            ) {
                return invalid('当前模型不支持此尺寸，请重新选择画面比例。');
            }
        }
        const streaming = form.get('stream') === 'true';
        const partial = Number(form.get('partial_images') || 2);
        if (streaming && (n !== 1 || model !== 'gpt-image-2'))
            return invalid('逐步预览仅支持 gpt-image-2，每次生成 1 张。');
        if (streaming && (!Number.isInteger(partial) || partial < 1 || partial > 3))
            return invalid('预览次数需为 1 至 3 次。');
        const storageMode = getStorageMode();
        const outputDir = getPrimaryImageDir();
        const openai = createRelayClient(credentials.apiKey, credentials.baseUrl);
        let outputFormat: 'png' | 'jpeg' | 'webp' = 'png';
        let params: OpenAI.Images.ImageGenerateParams | OpenAI.Images.ImageEditParams;
        if (mode === 'generate') {
            outputFormat = String(form.get('output_format') || 'png').replace(/^jpg$/, 'jpeg') as
                | 'png'
                | 'jpeg'
                | 'webp';
            if (!['png', 'jpeg', 'webp'].includes(outputFormat)) return invalid('请选择 PNG、JPEG 或 WebP 格式。');
            const background = String(form.get('background') || 'auto') as 'auto' | 'opaque' | 'transparent';
            const moderation = String(form.get('moderation') || 'auto') as 'auto' | 'low';
            if (!['auto', 'opaque', 'transparent'].includes(background) || !['auto', 'low'].includes(moderation))
                return invalid('背景或审核参数无效。');
            if (background === 'transparent' && (model === 'gpt-image-2' || outputFormat === 'jpeg'))
                return invalid('当前模型或格式不支持透明背景，请调整背景设置。');
            const compression = Number(form.get('output_compression') ?? 100);
            if (outputFormat !== 'png' && (!Number.isInteger(compression) || compression < 0 || compression > 100))
                return invalid('压缩质量需为 0 至 100。');
            params = {
                model,
                prompt,
                n,
                size: size as OpenAI.Images.ImageGenerateParams['size'],
                quality,
                output_format: outputFormat,
                background,
                moderation,
                ...(outputFormat !== 'png' ? { output_compression: compression } : {})
            };
        } else {
            const imageFiles = [...form.entries()]
                .filter(([name, value]) => /^image_\d+$/.test(name) && value instanceof File)
                .sort(([left], [right]) => Number(left.slice(6)) - Number(right.slice(6)))
                .map(([, file]) => file as File);
            if (!imageFiles.length || imageFiles.length > MAX_EDIT_IMAGES)
                return invalid(`请添加 1 至 ${MAX_EDIT_IMAGES} 张编辑图片。`);
            if (
                imageFiles.some(
                    (file) => !IMAGE_MIME_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES
                )
            )
                return invalid('编辑图片需为有效的 PNG、JPEG 或 WebP，每张小于 50 MB。');
            const mask = form.get('mask');
            if (
                mask !== null &&
                (!(mask instanceof File) || mask.type !== 'image/png' || mask.size === 0 || mask.size > MAX_IMAGE_BYTES)
            )
                return invalid('遮罩需为有效的 PNG 图片，且小于 50 MB。');
            params = {
                model,
                prompt,
                n,
                image: imageFiles,
                size: size as OpenAI.Images.ImageEditParams['size'],
                quality,
                ...(mask instanceof File ? { mask } : {})
            };
        }
        request.signal.throwIfAborted();
        if (storageMode === 'fs') await ensurePrimaryImageDirExists();
        if (streaming) {
            const stream =
                mode === 'generate'
                    ? await openai.images.generate(
                          { ...(params as OpenAI.Images.ImageGenerateParams), stream: true, partial_images: partial },
                          { signal: request.signal }
                      )
                    : await openai.images.edit(
                          { ...(params as OpenAI.Images.ImageEditParams), stream: true, partial_images: partial },
                          { signal: request.signal }
                      );
            return createStreamingImageResponse(stream as unknown as AsyncIterable<RelayStreamEvent>, {
                outputDir,
                fileExtension: outputFormat,
                saveToDisk: storageMode === 'fs',
                signal: request.signal,
                onCancel: () => stream.controller.abort()
            });
        }
        const result =
            mode === 'generate'
                ? await openai.images.generate(
                      { ...(params as OpenAI.Images.ImageGenerateParams), stream: false, response_format: 'b64_json' },
                      { signal: request.signal }
                  )
                : await openai.images.edit(
                      { ...(params as OpenAI.Images.ImageEditParams), stream: false, response_format: 'b64_json' },
                      { signal: request.signal }
                  );
        const relayError = extractRelayError(result);
        if (relayError) return NextResponse.json({ error: relayError, code: 'UPSTREAM_ERROR' }, { status: 502 });
        if (!result || !Array.isArray(result.data) || !result.data.length)
            return NextResponse.json(
                { error: '图像服务未返回图片，请检查模型和接口设置。', code: 'EMPTY_RESULT' },
                { status: 502 }
            );
        const prefix = `${Date.now()}-${crypto.randomUUID()}`;
        const processed = await Promise.allSettled(
            result.data.map(async (image, index) => {
                request.signal.throwIfAborted();
                const base64 =
                    image.b64_json || (image.url ? await fetchImageAsBase64(image.url, request.signal) : null);
                if (!base64) throw new Error('图像服务返回了不完整的图片数据。');
                const filename = `${prefix}-${index}.${outputFormat}`;
                if (storageMode === 'fs') {
                    await fs.writeFile(path.join(outputDir, filename), Buffer.from(base64, 'base64'));
                    return { filename, path: `/api/image/${filename}`, output_format: outputFormat };
                }
                return { filename, b64_json: base64, output_format: outputFormat };
            })
        );
        request.signal.throwIfAborted();
        const images = processed.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
        if (!images.length) {
            throw new Error('返回的图片未能读取或保存，请检查接口和存储配置后重试。');
        }
        const expected = Math.max(n, result.data.length);
        const warning =
            images.length < expected
                ? `本次请求 ${expected} 张图片，已保留 ${images.length} 张可用结果；其余图片未返回或未能保存。`
                : undefined;
        return NextResponse.json({ images, usage: result.usage, storageMode, warning });
    } catch (error) {
        if (request.signal.aborted)
            return NextResponse.json({ error: '请求已取消。', code: 'REQUEST_CANCELLED' }, { status: 499 });
        if (error instanceof ApiConfigError)
            return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
        const upstreamStatus =
            error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
                ? error.status
                : 502;
        const status = upstreamStatus >= 400 && upstreamStatus <= 599 ? upstreamStatus : 502;
        const code =
            status === 401 || status === 403
                ? 'UPSTREAM_AUTH_ERROR'
                : status === 429
                  ? 'UPSTREAM_RATE_LIMIT'
                  : 'UPSTREAM_ERROR';
        const detail = error instanceof Error ? error.message.slice(0, 1000) : '服务暂时无法响应，请稍后重试。';
        const message =
            code === 'UPSTREAM_AUTH_ERROR'
                ? `图像服务拒绝了 API 密钥，请检查 API 设置。${detail}`
                : status === 429
                  ? `请求过于频繁或额度不足，请检查服务商账户后重试。${detail}`
                  : detail;
        return NextResponse.json({ error: message, code }, { status });
    }
}
