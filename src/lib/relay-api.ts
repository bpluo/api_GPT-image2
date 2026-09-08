import { normalizeApiBaseUrl } from './api-config';
import OpenAI from 'openai';

// Some relay stations sit behind Cloudflare WAF rules that block the OpenAI SDK's
// default User-Agent, so we present a browser UA instead.
const BROWSER_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Relay stations expect the standard OpenAI path prefix, but users often paste a bare
// host like "https://gwlink.cc". The SDK appends "/images/generations" to baseURL, so a
// bare host would hit a non-existent route (often the station's HTML frontend, 200 OK).
// Append /v1 to bare hosts; keep user-supplied paths (e.g. ".../v1", ".../openai") as-is.
export function resolveBaseUrl(raw: string | null | undefined): string | undefined {
    return raw?.trim() ? normalizeApiBaseUrl(raw) : undefined;
}

export function createRelayClient(apiKey: string, baseURL?: string | null) {
    return new OpenAI({
        apiKey,
        baseURL: resolveBaseUrl(baseURL),
        maxRetries: 0,
        timeout: 600000,
        defaultHeaders: { 'User-Agent': process.env.OPENAI_API_USER_AGENT || BROWSER_USER_AGENT }
    });
}

// Relay stations may ignore response_format and return a URL instead of base64.
// Download those so the rest of the pipeline (which requires b64_json) keeps working.
export async function fetchImageAsBase64(url: string, signal?: AbortSignal): Promise<string> {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
        throw new Error('图像服务返回了无效的图片地址。');
    const response = await fetch(url, {
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000)
    });
    if (!response.ok) {
        throw new Error(`Failed to download image from relay URL (${response.status}).`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
}

// newapi-based relay stations report failures (e.g. "model_not_found", exhausted quota)
// as HTTP 200 + {"error": {...}} — the OpenAI SDK does not throw for those, so the raw
// result reaches callers looking like an empty payload. Detect both that shape and
// non-JSON (HTML) bodies, which indicate a wrong baseURL.
export function extractRelayError(result: unknown): string | null {
    if (typeof result === 'string') {
        const snippet = result.slice(0, 120).replace(/\s+/g, ' ');
        return `上游返回了非 JSON 响应，请检查 API 设置中的接口地址（Base URL）是否正确：${snippet}...`;
    }
    if (result && typeof result === 'object' && 'error' in result) {
        const error = (result as { error?: unknown }).error;
        if (error && typeof error === 'object' && 'message' in error) {
            return `上游 API 错误：${String((error as { message?: unknown }).message)}`;
        }
        if (error) {
            return `上游 API 错误：${JSON.stringify(error)}`;
        }
    }
    return null;
}
