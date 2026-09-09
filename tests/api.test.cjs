require('./register-typescript.cjs');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { NextRequest } = require('next/server');
const { POST: imagesPost } = require('../src/app/api/images/route.ts');
const { GET: modelsGet } = require('../src/app/api/models/route.ts');
const { POST: deletePost } = require('../src/app/api/image-delete/route.ts');
const { GET: authGet } = require('../src/app/api/auth-status/route.ts');
const { consumeImageStream } = require('../src/lib/image-request.ts');
let environment;
const variables = [
    'APP_PASSWORD',
    'OPENAI_API_KEY',
    'OPENAI_API_BASE_URL',
    'NEXT_PUBLIC_IMAGE_STORAGE_MODE',
    'IMAGE_STORAGE_DIR',
    'VERCEL'
];
beforeEach(() => {
    environment = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
    delete process.env.APP_PASSWORD;
    process.env.OPENAI_API_KEY = 'server-test-secret';
    process.env.OPENAI_API_BASE_URL = 'https://server.example/v1';
    process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE = 'indexeddb';
    process.env.IMAGE_STORAGE_DIR = path.join(__dirname, '../.npm-cache/ux-test-generated');
});
afterEach(() => {
    for (const [key, value] of Object.entries(environment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});
const payload = (patch = {}) => {
    const body = new FormData();
    for (const [key, value] of Object.entries({
        mode: 'generate',
        prompt: '本地测试',
        model: 'gpt-image-2',
        n: '1',
        size: 'auto',
        ...patch
    }))
        body.set(key, value);
    return body;
};
const request = (body = payload(), headers = {}) =>
    new NextRequest('http://localhost/api/images', { method: 'POST', body, headers });
const response = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

test('API 拒绝使用调用者地址发送服务端密钥，且不访问上游', async (t) => {
    let calls = 0;
    t.mock.method(global, 'fetch', async () => {
        calls++;
        throw new Error('不应访问网络');
    });
    const result = await imagesPost(request(payload(), { 'x-base-url': 'https://untrusted.example' }));
    assert.equal(result.status, 400);
    assert.equal((await result.json()).code, 'API_CONFIG_ERROR');
    assert.equal(calls, 0);
});
test('密码不正确时先拒绝请求；新密码可以成功重试', async (t) => {
    process.env.APP_PASSWORD = 'local-test-password';
    let calls = 0;
    t.mock.method(global, 'fetch', async () => {
        calls++;
        return response({ data: [{ b64_json: 'YWJj' }] });
    });
    assert.equal((await imagesPost(request(payload()))).status, 401);
    const wrong = await imagesPost(request(payload({ passwordHash: '0'.repeat(64) })));
    assert.equal((await wrong.json()).code, 'APP_PASSWORD_INVALID');
    assert.equal(calls, 0);
    const hash = crypto.createHash('sha256').update('local-test-password').digest('hex');
    const success = await imagesPost(request(payload({ passwordHash: hash })));
    assert.equal(success.status, 200);
    assert.equal(calls, 1);
});
test('无效模式、空白提示词、图片数量和尺寸不调用上游', async (t) => {
    let calls = 0;
    t.mock.method(global, 'fetch', async () => {
        calls++;
        throw new Error('不应访问网络');
    });
    for (const patch of [
        { mode: 'bad' },
        { prompt: '  ' },
        { n: 'NaN' },
        { n: '11' },
        { model: 'bad model!' },
        { size: '100x100' },
        { stream: 'true', n: '2' },
        { mode: 'edit' }
    ])
        assert.equal((await imagesPost(request(payload(patch)))).status, 400);
    assert.equal(calls, 0);
});
test('动态模型名不再被白名单拒绝，直接转发到上游', async (t) => {
    let upstreamModel = null;
    t.mock.method(global, 'fetch', async (url, init) => {
        const body = JSON.parse(String(init.body));
        upstreamModel = body.model;
        return response({ data: [{ b64_json: 'YWJj' }] });
    });
    const result = await imagesPost(request(payload({ model: 'agnes-image-9-pro' })));
    assert.equal(result.status, 200);
    assert.equal(upstreamModel, 'agnes-image-9-pro');
});
test('中文模型别名（中转站 4K 变体）能通过校验转发', async (t) => {
    let upstreamModel = null;
    t.mock.method(global, 'fetch', async (url, init) => {
        const body = JSON.parse(String(init.body));
        upstreamModel = body.model;
        return response({ data: [{ b64_json: 'YWJj' }] });
    });
    const result = await imagesPost(request(payload({ model: 'gpt-image-2-高质量4k' })));
    assert.equal(result.status, 200);
    assert.equal(upstreamModel, 'gpt-image-2-高质量4k');
});
test('个人凭据仅发往个人配置的接口，成功结果携带存储位置', async (t) => {
    t.mock.method(global, 'fetch', async (url, init) => {
        assert.match(String(url), /^https:\/\/personal\.example\/v1\/images\/generations/);
        assert.equal(new Headers(init.headers).get('authorization'), 'Bearer personal-test-key');
        return response({ data: [{ b64_json: 'YWJj' }] });
    });
    const result = await imagesPost(
        request(payload(), { 'x-api-key': 'personal-test-key', 'x-base-url': 'https://personal.example' })
    );
    const data = await result.json();
    assert.equal(result.status, 200);
    assert.equal(data.storageMode, 'indexeddb');
    assert.equal(data.images[0].b64_json, 'YWJj');
});
test('上游 API 密钥错误与工作台密码错误分开报告', async (t) => {
    t.mock.method(global, 'fetch', async () =>
        response(
            { error: { message: 'Incorrect API key', type: 'invalid_request_error', code: 'invalid_api_key' } },
            401
        )
    );
    const result = await imagesPost(request());
    assert.equal(result.status, 401);
    assert.equal((await result.json()).code, 'UPSTREAM_AUTH_ERROR');
});
test('上游返回 HTTP 200 的错误不会被显示成空图片成功', async (t) => {
    t.mock.method(global, 'fetch', async () => response({ error: { message: '模型额度不足' } }));
    const result = await imagesPost(request());
    assert.equal(result.status, 502);
    assert.match((await result.json()).error, /额度不足/);
});
test('文件存储结果不重复传输 base64，文件名不会因同毫秒碰撞', async (t) => {
    process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE = 'fs';
    t.mock.method(global, 'fetch', async () => response({ data: [{ b64_json: 'YWJj' }] }));
    const first = await (await imagesPost(request())).json();
    const second = await (await imagesPost(request())).json();
    assert.equal(first.storageMode, 'fs');
    assert.equal(first.images[0].b64_json, undefined);
    assert.ok(first.images[0].path);
    assert.notEqual(first.images[0].filename, second.images[0].filename);
});
test('编辑的流式选项真正传递到上游，并返回最终图片', async (t) => {
    t.mock.method(global, 'fetch', async (url, init) => {
        assert.match(String(url), /images\/edits/);
        const body = await new Request('http://localhost/test', {
            method: 'POST',
            headers: init.headers,
            body: init.body,
            duplex: 'half'
        }).formData();
        assert.equal(body.get('stream'), 'true');
        return new Response(
            'data: {"type":"image_edit.partial_image","b64_json":"YWJj"}\n\ndata: {"type":"image_edit.completed","b64_json":"YWJj"}\n\n',
            { headers: { 'content-type': 'text/event-stream' } }
        );
    });
    const body = payload({ mode: 'edit', stream: 'true' });
    body.set('image_0', new File(['png'], 'test.png', { type: 'image/png' }));
    const result = await imagesPost(request(body));
    assert.equal(result.status, 200);
    const data = await consumeImageStream(result, () => {});
    assert.equal(data.images.length, 1);
});
test('部署环境的存储模式由服务端统一返回', async () => {
    delete process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
    process.env.VERCEL = '1';
    const status = await (await authGet()).json();
    assert.equal(status.storageMode, 'indexeddb');
    assert.equal(status.hasServerKey, true);
});
test('删除接口拒绝空 JSON 和路径穿越，缺失文件可安全清理记录', async () => {
    const deleteRequest = (body) =>
        new NextRequest('http://localhost/api/image-delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        });
    assert.equal((await deletePost(deleteRequest(null))).status, 400);
    const result = await deletePost(deleteRequest({ filenames: ['../outside.png', 'never-created-ux-test.png'] }));
    const data = await result.json();
    assert.equal(result.status, 207);
    assert.equal(data.results[0].success, false);
    assert.equal(data.results[1].success, true);
});

test('批量返回不完整时保留已生成的图片，而不是丢弃整批结果', async (t) => {
    t.mock.method(global, 'fetch', async () => response({ data: [{ b64_json: 'YWJj' }, {}] }));
    const result = await imagesPost(request(payload({ n: '2' })));
    const data = await result.json();
    assert.equal(result.status, 200);
    assert.equal(data.images.length, 1);
    assert.match(data.warning, /1/);
});

test('模型列表接口请求上游 /models 并返回 id 列表', async (t) => {
    let requested = '';
    t.mock.method(global, 'fetch', async (url, init) => {
        requested = String(url);
        assert.equal(new Headers(init.headers).get('authorization'), 'Bearer server-test-secret');
        return response({ data: [{ id: 'gpt-image-2' }, { id: 'agnes-image-2.5-flash' }, { id: 'gpt-5' }] });
    });
    const result = await modelsGet(new NextRequest('http://localhost/api/models'));
    const data = await result.json();
    assert.equal(result.status, 200);
    assert.match(requested, /^https:\/\/server\.example\/v1\/models$/);
    assert.deepEqual(data.models, ['gpt-image-2', 'agnes-image-2.5-flash', 'gpt-5']);
});
test('模型列表接口不支持 /models 时返回内置选项，密钥错误如实上报', async (t) => {
    t.mock.method(global, 'fetch', async () => response({}, 404));
    const fallback = await modelsGet(new NextRequest('http://localhost/api/models'));
    assert.equal((await fallback.json()).source, 'fallback');
    t.mock.method(global, 'fetch', async () => response({}, 401));
    const rejected = await modelsGet(new NextRequest('http://localhost/api/models'));
    assert.equal(rejected.status, 401);
    assert.equal((await rejected.json()).code, 'UPSTREAM_AUTH_ERROR');
});
test('模型列表接口返回 HTML 时给出地址错误提示', async (t) => {
    t.mock.method(
        global,
        'fetch',
        async () => new Response('<html>login page</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    );
    const result = await modelsGet(new NextRequest('http://localhost/api/models'));
    assert.equal(result.status, 502);
    assert.match((await result.json()).error, /接口地址/);
});
test('调用者地址不能借用服务端密钥获取模型列表', async (t) => {
    let calls = 0;
    t.mock.method(global, 'fetch', async () => {
        calls++;
        throw new Error('不应访问网络');
    });
    const result = await modelsGet(
        new NextRequest('http://localhost/api/models', { headers: { 'x-base-url': 'https://untrusted.example' } })
    );
    assert.equal(result.status, 400);
    assert.equal((await result.json()).code, 'API_CONFIG_ERROR');
    assert.equal(calls, 0);
});
