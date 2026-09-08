require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const database = require('../src/lib/db.ts');
const { deleteHistoryFiles, loadHistoryImages, persistImageResult } = require('../src/lib/client-images.ts');
const { normalizeHistory } = require('../src/lib/history.ts');
const record = (patch = {}) =>
    normalizeHistory([{ id: 'entry', timestamp: 1, images: [{ filename: 'image.png' }], ...patch }])[0];

test('仅删除服务器图片时不依赖浏览器 IndexedDB', async (t) => {
    let localCalls = 0;
    t.mock.method(database, 'deleteStoredImages', async () => {
        localCalls++;
        throw new Error('浏览器存储不可用');
    });
    t.mock.method(
        global,
        'fetch',
        async () =>
            new Response(JSON.stringify({ results: [{ filename: 'image.png', success: true }] }), {
                headers: { 'content-type': 'application/json' }
            })
    );
    const result = await deleteHistoryFiles([record()], new Set(['entry']));
    assert.equal(localCalls, 0);
    assert.equal(result.error, null);
    assert.ok(result.removed.has('fs:image.png'));
});

test('历史图片按记录的实际存储位置读取', async (t) => {
    let calls = 0;
    t.mock.method(database, 'getStoredImage', async () => {
        calls++;
        return { blob: new Blob(['test'], { type: 'image/png' }) };
    });
    const disk = await loadHistoryImages(record());
    assert.equal(disk[0].path, '/api/image/image.png');
    assert.equal(calls, 0);
    const local = await loadHistoryImages(record({ storageModeUsed: 'indexeddb' }));
    assert.ok(local[0].path.startsWith('blob:'));
    assert.equal(calls, 1);
    URL.revokeObjectURL(local[0].path);
});

test('浏览器存储空间不足仍保留可下载的本次图片', async (t) => {
    t.mock.method(database.db.images, 'bulkPut', async () => {
        throw new Error('QuotaExceededError');
    });
    const result = await persistImageResult(
        { images: [{ filename: 'image.png', output_format: 'png', b64_json: 'YWJj' }] },
        'indexeddb'
    );
    assert.equal(result.saved, false);
    assert.equal(result.images.length, 1);
    assert.ok(result.images[0].path.startsWith('blob:'));
    URL.revokeObjectURL(result.images[0].path);
});
