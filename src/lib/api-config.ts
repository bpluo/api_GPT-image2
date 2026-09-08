export const DEFAULT_API_BASE_URL = 'https://api.openai.com/v1';

export class ApiConfigError extends Error {
    readonly code = 'API_CONFIG_ERROR';
}

export function normalizeApiBaseUrl(raw: string): string {
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        throw new ApiConfigError('接口地址无效，请填写完整的 http:// 或 https:// 地址。');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new ApiConfigError('接口地址仅支持 HTTP / HTTPS，且不能包含账号、密码、查询参数或锚点。');
    }
    url.pathname = url.pathname.replace(/\/+$/, '');
    if (url.pathname === '' || url.pathname === '/') url.pathname = '/v1';
    if (/\/images\/(generations|edits)$/.test(url.pathname)) {
        throw new ApiConfigError(
            '请填写接口根地址（例如 https://example.com/v1），不需要包含 /images/generations 或 /images/edits。'
        );
    }
    return url.toString().replace(/\/+$/, '');
}

export function resolveApiCredentials(
    input: { apiKey?: string | null; baseUrl?: string | null },
    server: { apiKey?: string; baseUrl?: string }
) {
    const apiKey = input.apiKey?.trim();
    const baseUrl = input.baseUrl?.trim();
    if (baseUrl && !apiKey) {
        throw new ApiConfigError('使用自定义接口地址时，请同时填写自己的 API Key。');
    }
    if (apiKey) return { apiKey, baseUrl: normalizeApiBaseUrl(baseUrl || DEFAULT_API_BASE_URL) };
    if (!server.apiKey?.trim()) throw new ApiConfigError('请先在 API 设置中填写密钥。');
    return {
        apiKey: server.apiKey.trim(),
        baseUrl: normalizeApiBaseUrl(server.baseUrl || DEFAULT_API_BASE_URL)
    };
}
