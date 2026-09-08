// 仅供本地浏览器验收：所有 API 写请求在此模拟，不转发到真实图像服务。
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const sharp = require('sharp');

const port = Number(process.env.UX_FIXTURE_PORT || 3020);
const appPort = Number(process.env.UX_APP_PORT || 3000);
const knownFiles = new Set();
const testPasswordHash = crypto.createHash('sha256').update('test-only').digest('hex');
const usage = { input_tokens_details: { text_tokens: 120, image_tokens: 0 }, output_tokens: 300 };
const json = (res, body, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
};

async function start() {
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="1024" height="768" fill="#edf7f3"/><circle cx="700" cy="210" r="220" fill="#c4e7d9"/><rect x="110" y="155" width="590" height="440" rx="60" fill="#183b35"/><circle cx="405" cy="375" r="130" fill="#6ed4b7"/><path d="M315 435 L405 280 L495 435Z" fill="#effbf6"/><text x="512" y="680" text-anchor="middle" font-family="Microsoft YaHei,sans-serif" font-size="30" fill="#183b35">本地验证图像 · 模拟接口</text></svg>';
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, `http://127.0.0.1:${port}`);
            const scenario = new URL(req.headers.referer || `http://127.0.0.1:${port}`).searchParams.get('scenario');
            if (url.pathname === '/api/auth-status')
                return json(res, {
                    hasServerKey: scenario !== 'setup',
                    passwordRequired: scenario === 'password',
                    storageMode: scenario === 'indexeddb' ? 'indexeddb' : 'fs'
                });
            if (url.pathname.startsWith('/api/image/') && req.method === 'GET') {
                res.writeHead(200, { 'content-type': 'image/png', 'content-length': png.length });
                return res.end(png);
            }
            if (url.pathname === '/api/images' && req.method === 'POST') {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const form = await new Request(`http://127.0.0.1:${port}/api/images`, {
                    method: 'POST',
                    headers: req.headers,
                    body: Buffer.concat(chunks)
                }).formData();
                if (scenario === 'password' && form.get('passwordHash') !== testPasswordHash)
                    return json(res, { error: '测试访问密码不正确，请重新输入。', code: 'APP_PASSWORD_INVALID' }, 401);
                const prompt = String(form.get('prompt'));
                if (prompt.includes('模拟失败'))
                    return json(res, { error: '模拟的服务暂时不可用，请稍后重试。', code: 'UPSTREAM_ERROR' }, 502);
                const n = Math.max(1, Math.min(Number(form.get('n')) || 1, 10));
                const images = Array.from({ length: n }, (_, index) => {
                    const filename = `ux-test-${Date.now()}-${index}.png`;
                    knownFiles.add(filename);
                    return {
                        filename,
                        output_format: 'png',
                        ...(scenario === 'indexeddb'
                            ? { b64_json: png.toString('base64') }
                            : { path: `/api/image/${filename}` })
                    };
                });
                const result = { images, usage, storageMode: scenario === 'indexeddb' ? 'indexeddb' : 'fs' };
                const delay = prompt.includes('等待测试') ? 60000 : 800;
                if (form.get('stream') === 'true') {
                    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
                    res.write(
                        `data: ${JSON.stringify({ type: 'partial_image', b64_json: png.toString('base64'), output_format: 'png' })}\n\n`
                    );
                    const timer = setTimeout(() => {
                        if (prompt.includes('模拟中断')) return res.end();
                        res.end(`data: ${JSON.stringify({ type: 'done', ...result })}\n\n`);
                    }, delay);
                    res.on('close', () => clearTimeout(timer));
                } else {
                    const timer = setTimeout(() => json(res, result), delay);
                    res.on('close', () => clearTimeout(timer));
                }
                return;
            }
            if (url.pathname === '/api/image-delete') {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const body = JSON.parse(Buffer.concat(chunks).toString());
                return json(
                    res,
                    {
                        results: body.filenames.map((filename, index) => ({
                            filename,
                            success: scenario !== 'partial-delete' || index !== 0
                        }))
                    },
                    scenario === 'partial-delete' ? 207 : 200
                );
            }
            if (req.method !== 'GET' && req.method !== 'HEAD')
                return json(res, { error: '测试代理不转发任何写请求。' }, 405);
            const proxy = http.request(
                {
                    host: '127.0.0.1',
                    port: appPort,
                    path: req.url,
                    method: req.method,
                    headers: { ...req.headers, host: `127.0.0.1:${appPort}` }
                },
                (upstream) => {
                    res.writeHead(upstream.statusCode, upstream.headers);
                    upstream.pipe(res);
                }
            );
            proxy.on('error', () => json(res, { error: '请先启动本地 Next.js 开发服务。' }, 502));
            req.pipe(proxy);
        } catch (error) {
            if (!res.headersSent) json(res, { error: error.message }, 500);
            else res.end();
        }
    });
    server.on('upgrade', (req, socket, head) => {
        const upstream = net.connect(appPort, '127.0.0.1', () => {
            const headers = { ...req.headers, host: `127.0.0.1:${appPort}` };
            upstream.write(
                `${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(headers)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\r\n')}\r\n\r\n`
            );
            if (head.length) upstream.write(head);
            socket.pipe(upstream);
            upstream.pipe(socket);
        });
        upstream.on('error', () => socket.destroy());
        socket.on('error', () => upstream.destroy());
    });
    server.listen(port, '127.0.0.1', () =>
        console.log(`本地模拟接口已启动：http://127.0.0.1:${port}，所有生成请求均为测试，不计费。`)
    );
}
start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
