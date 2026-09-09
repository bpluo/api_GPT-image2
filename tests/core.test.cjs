require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeApiBaseUrl, resolveApiCredentials } = require('../src/lib/api-config.ts');
const { DEFAULT_IMAGE_SETTINGS, normalizeImageSettings, selectImageFiles } = require('../src/lib/image-settings.ts');
const { buildImageFormData, consumeImageStream, requestImages } = require('../src/lib/image-request.ts');
const {
    normalizeHistory,
    planHistoryDeletion,
    applyHistoryDeletion,
    groupHistoryBySession
} = require('../src/lib/history.ts');
const { calculateApiCost } = require('../src/lib/cost-utils.ts');
const {
    activeProfile,
    loadProfileStore,
    normalizeStore,
    profileCredentials,
    saveProfileStore
} = require('../src/lib/api-profiles.ts');
const { createStreamingImageResponse } = require('../src/lib/image-stream.ts');

const settings = (patch = {}) => ({ ...DEFAULT_IMAGE_SETTINGS, prompt: '测试画面', ...patch });
const record = (patch = {}) =>
    normalizeHistory([{ id: 'a', timestamp: 100, mode: 'generate', images: [{ filename: 'a.png' }], ...patch }])[0];
const imageResult = {
    images: [{ filename: 'result.png', b64_json: 'YWJj', output_format: 'png' }],
    storageMode: 'indexeddb'
};
const streamResponse = (text, chunkSize = 7) => {
    const bytes = new TextEncoder().encode(text);
    return new Response(
        new ReadableStream({
            start(controller) {
                for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
                controller.close();
            }
        })
    );
};

test('接口域名自动补 /v1，保留自定义根路径', () => {
    assert.equal(normalizeApiBaseUrl(' https://example.com/// '), 'https://example.com/v1');
    assert.equal(normalizeApiBaseUrl('https://example.com/openai/'), 'https://example.com/openai');
});
test('拒绝无效协议、嵌入凭据和错误的完整接口路径', () => {
    for (const url of [
        'invalid',
        'file:///tmp/test',
        'ftp://example.com',
        'https://user:pass@example.com',
        'https://example.com?key=secret',
        'https://example.com/#fragment',
        'https://example.com/v1/images/generations'
    ])
        assert.throws(() => normalizeApiBaseUrl(url));
});
test('自定义地址不能借用服务端密钥', () => {
    assert.throws(
        () => resolveApiCredentials({ baseUrl: 'https://untrusted.example' }, { apiKey: 'server-secret' }),
        /自己的 API Key/
    );
});
test('个人密钥和服务端配置分别解析，不混用不同服务商', () => {
    const server = { apiKey: 'server-key', baseUrl: 'https://server.example' };
    assert.deepEqual(resolveApiCredentials({ apiKey: 'personal-key' }, server), {
        apiKey: 'personal-key',
        baseUrl: 'https://api.openai.com/v1'
    });
    assert.deepEqual(resolveApiCredentials({}, server), { apiKey: 'server-key', baseUrl: 'https://server.example/v1' });
});
test('旧草稿损坏的参数恢复为有效默认值，动态模型名保留', () => {
    const result = normalizeImageSettings({
        model: 'missing',
        n: 500,
        partial_images: 100,
        quality: 'impossible',
        prompt: 123
    });
    // 模型列表现在来自接口动态获取，未知模型名不再被白名单重置。
    assert.equal(result.model, 'missing');
    assert.equal(result.n, 10);
    assert.equal(result.partial_images, 3);
    assert.equal(result.quality, 'auto');
    assert.equal(result.prompt, '');
    assert.equal(normalizeImageSettings({ model: '   ' }).model, 'gpt-image-2');
});
test('切换模型、数量或格式时只保留兼容参数', () => {
    assert.equal(normalizeImageSettings(settings({ n: 2, stream: true })).stream, false);
    assert.equal(normalizeImageSettings(settings({ model: 'gpt-image-1', size: 'custom' })).size, 'auto');
    assert.equal(normalizeImageSettings(settings({ background: 'transparent' })).background, 'auto');
    assert.equal(
        normalizeImageSettings(settings({ model: 'gpt-image-1', background: 'transparent', output_format: 'jpeg' }))
            .output_format,
        'png'
    );
});
test('生成与编辑的流式请求都包含正确选项', () => {
    for (const mode of ['generate', 'edit']) {
        const body = buildImageFormData(
            {
                mode,
                settings: settings({ stream: true, partial_images: 3 }),
                imageFiles: [new File(['image'], 'image.png', { type: 'image/png' })]
            },
            'new-password'
        );
        assert.equal(body.get('mode'), mode);
        assert.equal(body.get('stream'), 'true');
        assert.equal(body.get('partial_images'), '3');
        assert.equal(body.get('passwordHash'), 'new-password');
    }
});
test('请求使用传入的参数快照及新密码，不依赖当前页面模式', () => {
    const snapshot = {
        mode: 'generate',
        settings: settings({
            size: 'custom',
            customWidth: 3840,
            customHeight: 2160,
            output_format: 'jpeg',
            output_compression: 0
        })
    };
    const body = buildImageFormData(snapshot, 'fresh-hash');
    assert.equal(body.get('size'), '3840x2160');
    assert.equal(body.get('output_compression'), '0');
    assert.equal(body.get('passwordHash'), 'fresh-hash');
    snapshot.settings.prompt = '后来修改的草稿';
    assert.equal(body.get('prompt'), '测试画面');
});
test('提交前拒绝空白提示词、错误尺寸和缺失素材', () => {
    assert.throws(() => buildImageFormData({ mode: 'generate', settings: settings({ prompt: '   ' }) }));
    assert.throws(() =>
        buildImageFormData({
            mode: 'generate',
            settings: settings({ size: 'custom', customWidth: 100, customHeight: 100 })
        })
    );
    assert.throws(() => buildImageFormData({ mode: 'edit', settings: settings(), imageFiles: [] }));
});
test('文件入口统一校验类型、空文件、重复项和数量上限', () => {
    const file = new File(['a'], 'a.png', { type: 'image/png', lastModified: 1 });
    const valid = new File(['b'], 'b.webp', { type: 'image/webp' });
    const invalid = new File(['svg'], 'bad.svg', { type: 'image/svg+xml' });
    const empty = new File([], 'empty.png', { type: 'image/png' });
    const result = selectImageFiles([file], [file, invalid, empty, valid]);
    assert.deepEqual(result.accepted, [valid]);
    assert.match(result.message, /已添加/);
    assert.equal(selectImageFiles([file], [valid], 1).accepted.length, 0);
});
test('流式解析兼容分包、CRLF、中文和无结尾空行', async () => {
    const previews = [];
    const text =
        ': 心跳\r\n\r\ndata: ' +
        JSON.stringify({ type: 'partial_image', b64_json: 'YWJj', output_format: 'webp' }) +
        '\r\n\r\ndata:' +
        JSON.stringify({ type: 'done', ...imageResult });
    const result = await consumeImageStream(streamResponse(text, 1), (index, url) => previews.push([index, url]));
    assert.equal(result.images.length, 1);
    assert.equal(previews[0][1], 'data:image/webp;base64,YWJj');
});
test('流式中断、空结果和错误事件不能误判为成功', async () => {
    for (const text of [
        '',
        'data: {"type":"partial_image","b64_json":"abc"}\n\n',
        'data: {"type":"done","images":[]}\n\n',
        'data: {"type":"error","error":"额度不足"}\n\n',
        'data: {broken}\n\n'
    ]) {
        await assert.rejects(consumeImageStream(streamResponse(text), () => {}));
    }
});
test('上游 401 保留 API 错误码，不被误认为工作台密码错误', async (t) => {
    t.mock.method(
        global,
        'fetch',
        async () =>
            new Response(JSON.stringify({ error: '密钥无效', code: 'UPSTREAM_AUTH_ERROR' }), {
                status: 401,
                headers: { 'content-type': 'application/json' }
            })
    );
    await assert.rejects(
        requestImages({ mode: 'generate', settings: settings() }, {}, new AbortController().signal, () => {}),
        (error) => error.code === 'UPSTREAM_AUTH_ERROR'
    );
});
test('非 JSON 网关错误返回可操作提示', async (t) => {
    t.mock.method(global, 'fetch', async () => new Response('<html>gateway error</html>', { status: 502 }));
    await assert.rejects(
        requestImages({ mode: 'generate', settings: settings() }, {}, new AbortController().signal, () => {}),
        /502/
    );
});
test('用户取消后保留取消语义', async (t) => {
    const controller = new AbortController();
    controller.abort();
    t.mock.method(global, 'fetch', async () => {
        throw controller.signal.reason;
    });
    await assert.rejects(
        requestImages({ mode: 'generate', settings: settings() }, {}, controller.signal, () => {}),
        (error) => error.name === 'AbortError'
    );
});
test('历史迁移保留有效条目，隔离坏记录与不安全文件名', () => {
    const result = normalizeHistory([
        null,
        {},
        { images: [null] },
        { images: [{ filename: '../secret.png' }] },
        { timestamp: 12, images: [{ filename: 'safe.png' }] }
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].storageModeUsed, 'fs');
    assert.equal(result[0].images[0].filename, 'safe.png');
    assert.throws(() => normalizeHistory({}));
});
test('重复时间戳和重复 ID 不导致误删其他条目', () => {
    const items = normalizeHistory([
        { id: 'same', timestamp: 1, images: [{ filename: 'a.png' }] },
        { id: 'same', timestamp: 1, images: [{ filename: 'b.png' }] }
    ]);
    assert.notEqual(items[0].id, items[1].id);
    const remaining = applyHistoryDeletion(items, new Set([items[0].id]), new Set(['fs:a.png']));
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].images[0].filename, 'b.png');
});
test('删除部分失败时保留失败图片及其历史参数', () => {
    const entry = record({ images: [{ filename: 'a.png' }, { filename: 'b.png' }] });
    const remaining = applyHistoryDeletion([entry], new Set(['a']), new Set(['fs:a.png']));
    assert.equal(remaining.length, 1);
    assert.deepEqual(remaining[0].images, [{ filename: 'b.png' }]);
    assert.equal(remaining[0].coverImageFilename, 'b.png');
});
test('删除计划保护其他记录引用的图片，并区分存储位置', () => {
    const history = [
        record(),
        record({ id: 'b', images: [{ filename: 'a.png' }] }),
        record({ id: 'c', storageModeUsed: 'indexeddb', images: [{ filename: 'a.png' }] })
    ];
    const plan = planHistoryDeletion(history, new Set(['a', 'c']));
    assert.deepEqual([...plan.shared], ['fs:a.png']);
    assert.deepEqual(plan.files, [{ filename: 'a.png', storageMode: 'indexeddb' }]);
});
test('旧版编辑记录通过源图正确归组，多步编辑不断链', () => {
    const items = [
        record(),
        record({
            id: 'b',
            timestamp: 200,
            mode: 'edit',
            images: [{ filename: 'b.png' }],
            sourceImageFilenames: ['a.png']
        }),
        record({ id: 'c', timestamp: 300, mode: 'edit', images: [{ filename: 'c.png' }], parentId: 'b' })
    ];
    assert.equal(groupHistoryBySession(items).length, 1);
    assert.equal(groupHistoryBySession(items)[0].items.length, 3);
});
test('未知计费模型和异常令牌用量不显示伪造费用', () => {
    const usage = { input_tokens_details: { text_tokens: 100, image_tokens: 100 }, output_tokens: 100 };
    assert.equal(calculateApiCost(usage, 'agnes-image-2.5-flash'), null);
    assert.equal(calculateApiCost({ ...usage, output_tokens: -1 }), null);
    assert.equal(calculateApiCost({ ...usage, output_tokens: Infinity }), null);
    assert.equal(calculateApiCost(usage, 'gpt-image-2').estimated_cost_usd, 0.0043);
});
test('生成和编辑的上游流均转换成可读的完成结果', async () => {
    for (const prefix of ['image_generation', 'image_edit']) {
        async function* events() {
            yield { type: `${prefix}.partial_image`, b64_json: 'YWJj' };
            yield { type: `${prefix}.completed`, b64_json: 'YWJj' };
        }
        const response = createStreamingImageResponse(events(), {
            outputDir: '.',
            fileExtension: 'png',
            saveToDisk: false
        });
        const result = await consumeImageStream(response, () => {});
        assert.equal(result.images.length, 1);
        assert.equal(result.storageMode, 'indexeddb');
    }
});
test('上游空完成事件不会被保存成空图片', async () => {
    async function* events() {
        yield { type: 'image_generation.completed', b64_json: '' };
    }
    await assert.rejects(
        consumeImageStream(
            createStreamingImageResponse(events(), { outputDir: '.', fileExtension: 'png', saveToDisk: false }),
            () => {}
        ),
        /空图片/
    );
});
test('中止前已取消的服务端流会结束，不会悬挂', async () => {
    const controller = new AbortController();
    controller.abort();
    let cancelled = false;
    async function* events() {
        throw new Error('不应读取上游');
    }
    const response = createStreamingImageResponse(events(), {
        outputDir: '.',
        fileExtension: 'png',
        saveToDisk: false,
        signal: controller.signal,
        onCancel: () => {
            cancelled = true;
        }
    });
    assert.equal(await response.text(), '');
    assert.equal(cancelled, true);
});

test('已完成图片后的流连接异常仍保留可用结果', async () => {
    async function* events() {
        yield { type: 'image_generation.completed', b64_json: 'YWJj' };
        throw new Error('连接中断');
    }
    const result = await consumeImageStream(
        createStreamingImageResponse(events(), { outputDir: '.', fileExtension: 'png', saveToDisk: false }),
        () => {}
    );
    assert.equal(result.images.length, 1);
    assert.ok(result.warning);
});

test('仍被后续编辑引用的源图不能被物理删除', () => {
    const history = [
        record(),
        record({ id: 'b', mode: 'edit', images: [{ filename: 'b.png' }], sourceImageFilenames: ['a.png'] })
    ];
    const plan = planHistoryDeletion(history, new Set(['a']));
    assert.equal(plan.files.length, 0);
    assert.ok(plan.shared.has('fs:a.png'));
});

test('损坏的模板标签不会令历史搜索崩溃', () => {
    const entry = record({ presetTitle: {}, presetTags: 'invalid' });
    assert.equal(entry.presetTitle, undefined);
    assert.equal(entry.presetTags, undefined);
});

test('尺寸中的非法输入保留并提示，不静默换成默认分辨率', () => {
    const invalid = normalizeImageSettings(settings({ size: 'custom', customWidth: -16, customHeight: 1.5 }));
    assert.equal(invalid.customWidth, -16);
    assert.equal(invalid.customHeight, 1.5);
    assert.throws(() => buildImageFormData({ mode: 'generate', settings: invalid }), /宽度和高度/);
});

const memoryStorage = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => void map.set(key, value)
    };
};
test('旧版单份 API 设置自动迁移为多配置存储', () => {
    const storage = memoryStorage({
        apiSettings: JSON.stringify({ apiKey: ' legacy-key ', baseUrl: 'https://legacy.example/v1' })
    });
    const store = loadProfileStore(storage);
    assert.equal(store.profiles.length, 1);
    assert.equal(store.profiles[0].apiKey, 'legacy-key');
    assert.equal(store.profiles[0].baseUrl, 'https://legacy.example/v1');
    assert.equal(store.activeId, store.profiles[0].id);
    assert.equal(saveProfileStore(store, storage), true);
    assert.equal(loadProfileStore(storage).profiles[0].id, store.profiles[0].id);
});
test('多配置的规范化：去重、截断、丢弃坏记录、修复失效的 activeId', () => {
    const store = normalizeStore({
        activeId: 'gone',
        profiles: [
            { apiKey: 'a' },
            { id: 'dup', name: 'x'.repeat(50), baseUrl: 'https://a.example/v1', apiKey: 'a' },
            { id: 'dup', apiKey: 'b' },
            { apiKey: '' },
            null,
            { apiKey: 'c', baseUrl: 'not a url' }
        ]
    });
    assert.equal(store.profiles.length, 3);
    assert.equal(store.profiles[1].name.length, 30);
    assert.equal(store.activeId, store.profiles[0].id);
    assert.notEqual(store.profiles[0].id, store.profiles[2].id);
});
test('未选择配置时凭据为空，选择后返回该配置的密钥与地址', () => {
    const store = normalizeStore({
        profiles: [
            { id: 'one', apiKey: 'key-one', baseUrl: 'https://one.example/v1' },
            { id: 'two', apiKey: 'key-two', baseUrl: '' }
        ]
    });
    assert.deepEqual(activeProfile({ ...store, activeId: 'two' }), {
        id: 'two',
        name: '配置 2',
        baseUrl: '',
        apiKey: 'key-two'
    });
    assert.deepEqual(profileCredentials({ ...store, activeId: 'two' }), {
        apiKey: 'key-two',
        baseUrl: ''
    });
});
