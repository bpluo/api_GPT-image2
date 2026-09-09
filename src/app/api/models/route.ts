import { ApiConfigError, resolveApiCredentials } from '@/lib/api-config';
import { BROWSER_USER_AGENT } from '@/lib/relay-api';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Some relay stations don't implement GET /models. This curated list keeps the
// model picker usable for known image models; the fetched list (when available)
// takes precedence and is merged on top.
export const FALLBACK_IMAGE_MODELS = ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-2'];

export function selectImageModelIds(raw: unknown): string[] {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { data?: unknown }).data)) return [];
    const ids: string[] = [];
    for (const entry of (raw as { data: unknown[] }).data) {
        const id =
            typeof entry === 'string'
                ? entry
                : entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
                  ? (entry as { id: string }).id
                  : null;
        if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
}

export async function GET(request: NextRequest) {
    try {
        const credentials = resolveApiCredentials(
            { apiKey: request.headers.get('x-api-key'), baseUrl: request.headers.get('x-base-url') },
            { apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_API_BASE_URL }
        );
        const response = await fetch(`${credentials.baseUrl}/models`, {
            headers: {
                Authorization: `Bearer ${credentials.apiKey}`,
                'User-Agent': process.env.OPENAI_API_USER_AGENT || BROWSER_USER_AGENT
            },
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)])
        });
        if (response.status === 401 || response.status === 403) {
            return NextResponse.json(
                { error: '图像服务拒绝了 API 密钥，请检查密钥是否正确。', code: 'UPSTREAM_AUTH_ERROR' },
                { status: 401 }
            );
        }
        if (response.status === 404) {
            // Relay station without /models support — fall back to curated list.
            return NextResponse.json({ models: FALLBACK_IMAGE_MODELS, source: 'fallback' });
        }
        if (!response.ok) {
            return NextResponse.json(
                { error: `模型列表获取失败（${response.status}），可手动输入模型名。`, code: 'UPSTREAM_ERROR' },
                { status: 502 }
            );
        }
        const text = await response.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            // newapi-based relays sometimes return the HTML frontend here (wrong baseURL).
            const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
            return NextResponse.json(
                {
                    error: `接口未返回模型列表，请检查接口地址是否正确：${snippet}…`,
                    code: 'INVALID_RESPONSE'
                },
                { status: 502 }
            );
        }
        const ids = selectImageModelIds(parsed);
        if (!ids.length) {
            return NextResponse.json(
                { error: '接口返回的模型列表为空，可手动输入模型名。', code: 'EMPTY_MODELS' },
                { status: 502 }
            );
        }
        return NextResponse.json({ models: ids, source: 'upstream' });
    } catch (error) {
        if (request.signal.aborted)
            return NextResponse.json({ error: '请求已取消。', code: 'REQUEST_CANCELLED' }, { status: 499 });
        if (error instanceof ApiConfigError)
            return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
        return NextResponse.json(
            { error: '模型列表暂时无法获取，可手动输入模型名。', code: 'UPSTREAM_ERROR' },
            { status: 502 }
        );
    }
}
