require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_IMAGE_SETTINGS } = require('../src/lib/image-settings.ts');
const { normalizeHistory } = require('../src/lib/history.ts');
const {
    allPromptTemplates,
    presetPromptCategories,
    getPromptCategoriesForMode,
    getAcademicPromptsForMode,
    findPromptTemplates
} = require('../src/lib/preset-prompts.ts');
const {
    getTemplateExamples,
    fillTemplateExamples,
    buildTemplatePrompt,
    appendPromptConstraints,
    createTemplateApplication,
    createConstraintApplication,
    getPromptUndoPatch,
    getPromptNotices,
    promptConstraintSnippets
} = require('../src/lib/prompt-tools.ts');
const template = (id) => {
    const result = allPromptTemplates.find((item) => item.id === id);
    assert.ok(result, `模板应存在：${id}`);
    return result;
};
const settings = (patch = {}) => ({
    ...DEFAULT_IMAGE_SETTINGS,
    prompt: '我原来的画面描述',
    quality: 'medium',
    n: 3,
    ...patch
});

test('模板分类与字段完整，稳定 ID 不重复，示例可生成完整提示词', () => {
    const ids = new Set();
    assert.equal(presetPromptCategories.length, 6);
    assert.equal(allPromptTemplates.length, 24);
    for (const item of allPromptTemplates) {
        assert.ok(!ids.has(item.id), `重复模板 ID：${item.id}`);
        ids.add(item.id);
        assert.ok(item.categoryId && item.categoryLabel && item.title && item.description);
        assert.ok(item.fields.some((field) => field.required));
        assert.equal(new Set(item.fields.map((field) => field.id)).size, item.fields.length);
        assert.ok(item.constraints.length > 0);
        const result = buildTemplatePrompt(item, getTemplateExamples(item));
        assert.equal(result.ready, true, item.id);
        assert.doesNotMatch(result.prompt, /【请填写：|undefined|\{\{/);
    }
});

test('模板按真实使用模式显示，原有非科研分类可访问', () => {
    assert.equal(findPromptTemplates('generate').length, 17);
    assert.equal(findPromptTemplates('edit').length, 7);
    assert.deepEqual(
        getPromptCategoriesForMode('edit').map((category) => category.id),
        ['academic', 'editing']
    );
    assert.ok(findPromptTemplates('generate').some((item) => item.categoryId === 'illustration'));
    assert.ok(findPromptTemplates('generate').every((item) => item.mode === 'generate'));
    assert.ok(findPromptTemplates('edit').every((item) => item.mode === 'edit'));
    assert.equal(getAcademicPromptsForMode('edit').length, 2);
});

test('搜索支持中文、多关键词和英文别名，过滤无结果时不回退到错误模板', () => {
    assert.equal(findPromptTemplates('generate', ' METHOD  pipeline ')[0].id, 'method-pipeline');
    assert.equal(findPromptTemplates('generate', '架构 流程', 'academic')[0].id, 'method-pipeline');
    assert.deepEqual(findPromptTemplates('edit', 'pipeline'), []);
    assert.deepEqual(findPromptTemplates('generate', '不存在的场景'), []);
    assert.deepEqual(findPromptTemplates('generate', '', 'editing'), []);
});

test('未填必填项时仅显示预览占位，并阻止直接应用', () => {
    const item = template('method-pipeline');
    const result = buildTemplatePrompt(item, { subject: '   ' });
    assert.equal(result.ready, false);
    assert.ok(result.errors.subject && result.errors.flow);
    assert.match(result.prompt, /【请填写：/);
    assert.throws(() => createTemplateApplication(settings(), item, {}), /请填写/);
});

test('用户输入的符号、换行和引号作为原文保留，不进行二次模板替换', () => {
    const item = template('replace-text');
    const text = '顶部“售价”替换为“$& 12.50”；保留 {{literal}}\n第二行：β = 0.2';
    const result = buildTemplatePrompt(item, { changes: text });
    assert.equal(result.ready, true);
    assert.ok(result.prompt.includes(text));
});

test('未填写的可选字段不会成为空标题或未完成占位符', () => {
    const result = buildTemplatePrompt(template('product-hero'), { subject: '无文字的白色陶瓷杯' });
    assert.equal(result.ready, true);
    assert.doesNotMatch(result.prompt, /重点表现的细节：|背景与摆放：|【请填写：/);
});

test('补充示例只填空白项，保留用户已输入的研究材料和真实数据', () => {
    const values = { subject: '用户的真实研究任务', data: '方法 A：82.1%；n=5。' };
    const result = fillTemplateExamples(template('scientific-chart'), values);
    assert.equal(result.subject, values.subject);
    assert.equal(result.data, values.data);
    assert.ok(result.labels);
    assert.equal(values.labels, undefined);
});

test('科研示例不会把虚构数字或提示说明当成实验数据', () => {
    const item = template('scientific-chart');
    const examples = getTemplateExamples(item);
    assert.equal(examples.data, '');
    const result = buildTemplatePrompt(item, examples);
    assert.match(result.prompt, /当前未提供真实数据/);
    assert.match(result.prompt, /不绘制代表实验结果的曲线/);
    assert.equal(getTemplateExamples(template('graphical-abstract')).outcome, '');
});

test('提供真实数据后保留原始内容并去掉缺数据分支', () => {
    const result = buildTemplatePrompt(template('scientific-chart'), {
        subject: '比较准确率',
        data: '方法 A：82.1%；方法 B：83.4%；n=5；误差为标准差。'
    });
    assert.ok(result.prompt.includes('方法 A：82.1%；方法 B：83.4%；n=5；误差为标准差。'));
    assert.doesNotMatch(result.prompt, /当前未提供真实数据/);
    assert.match(result.prompt, /不编造数据/);
});

test('生成模板明确文字语言，编辑模板保留原图语言', () => {
    const item = template('method-pipeline');
    assert.match(
        buildTemplatePrompt(item, getTemplateExamples(item), { language: 'en' }).prompt,
        /说明性标签使用简洁英文/
    );
    const edit = template('scientific-refinement');
    const result = buildTemplatePrompt(edit, getTemplateExamples(edit), { language: 'en' });
    assert.match(result.prompt, /保留原图文字的内容与语言/);
    assert.doesNotMatch(result.prompt, /说明性标签使用简洁英文/);
});

test('无文字要求与必须出现的文案或学术标签冲突时不能应用', () => {
    const item = template('information-poster');
    assert.equal(buildTemplatePrompt(item, getTemplateExamples(item), { language: 'none' }).ready, false);
    const academic = template('method-pipeline');
    assert.ok(buildTemplatePrompt(academic, getTemplateExamples(academic), { language: 'none' }).errors.language);
    const photo = template('product-hero');
    assert.equal(buildTemplatePrompt(photo, getTemplateExamples(photo), { language: 'none' }).ready, true);
});

test('应用模板默认只更新提示词，不自动提高质量或改变其他设置', () => {
    const current = settings({ size: 'square', model: 'gpt-image-1-mini' });
    const before = { ...current };
    const item = template('method-pipeline');
    const result = createTemplateApplication(current, item, getTemplateExamples(item));
    assert.deepEqual(Object.keys(result.patch), ['prompt']);
    assert.deepEqual(current, before);
});

test('勾选推荐参数时仅更新公开展示的参数，保留模型和生成数量', () => {
    const item = template('method-pipeline');
    const result = createTemplateApplication(settings(), item, getTemplateExamples(item), { applyRecommended: true });
    assert.equal(result.patch.size, 'landscape');
    assert.equal(result.patch.quality, 'high');
    assert.equal(result.patch.output_format, 'png');
    assert.equal(result.patch.model, undefined);
    assert.equal(result.patch.n, undefined);
    const edit = template('scientific-refinement');
    const editResult = createTemplateApplication(settings(), edit, getTemplateExamples(edit), {
        applyRecommended: true
    });
    assert.equal(editResult.patch.output_format, undefined);
});

test('只追加规范不重复任务和字段，也不携带未填写的数据判断或生成参数', () => {
    const item = template('scientific-chart');
    const result = createConstraintApplication(settings(), item.constraints);
    assert.ok(result.patch.prompt.startsWith('我原来的画面描述'));
    assert.doesNotMatch(result.patch.prompt, /当前未提供真实数据|【请填写：|画面要求：/);
    assert.deepEqual(Object.keys(result.patch), ['prompt']);
    assert.throws(() => createConstraintApplication(settings({ prompt: '  ' }), item.constraints), /请先填写/);
});

test('重复规范、不同列表符号和末尾标点会去重，多次追加保持幂等', () => {
    const rule = '主体完整入画。';
    const first = appendPromptConstraints('原文\n* 主体完整入画', [rule, '不加水印。', '不加水印。']);
    assert.equal(first.addedCount, 1);
    const second = appendPromptConstraints(first.prompt, [rule, '不加水印。']);
    assert.equal(second.addedCount, 0);
    assert.equal(second.prompt, first.prompt);
    assert.equal(appendPromptConstraints('原文\n\n', []).prompt, '原文\n\n');
});

test('撤销模板应用能恢复提示词和推荐参数', () => {
    const before = settings({ size: 'square', quality: 'low', output_format: 'webp' });
    const item = template('method-pipeline');
    const application = createTemplateApplication(before, item, getTemplateExamples(item), { applyRecommended: true });
    const undo = getPromptUndoPatch({ ...before, ...application.patch }, application);
    assert.deepEqual(undo, { prompt: before.prompt, size: 'square', quality: 'low', output_format: 'webp' });
});

test('撤销不会覆盖后续编辑的提示词，或后来另行修改的参数', () => {
    const before = settings({ quality: 'low' });
    const item = template('method-pipeline');
    const application = createTemplateApplication(before, item, getTemplateExamples(item), { applyRecommended: true });
    assert.equal(
        getPromptUndoPatch({ ...before, ...application.patch, prompt: '我后来改写的描述' }, application),
        null
    );
    const undo = getPromptUndoPatch({ ...before, ...application.patch, quality: 'medium', n: 7 }, application);
    assert.equal(undo.quality, undefined);
    assert.equal(undo.n, undefined);
    assert.equal(undo.prompt, before.prompt);
});

test('常用约束按模式显示，并且简短明确的提示词不会被判为错误', () => {
    assert.ok(promptConstraintSnippets.find((snippet) => snippet.id === 'edit-scope').modes.includes('edit'));
    assert.ok(!promptConstraintSnippets.find((snippet) => snippet.id === 'edit-scope').modes.includes('generate'));
    assert.deepEqual(getPromptNotices('增强对比度'), []);
    assert.ok(getPromptNotices('主体：【请填写：主体】').length > 0);
});

test('新模板的稳定 ID 与真实分类可保存在历史中，旧记录仍兼容', () => {
    const item = template('watercolor-scene');
    const record = normalizeHistory([
        {
            id: 'entry',
            images: [{ filename: 'image.png' }],
            presetId: item.id,
            presetTitle: item.title,
            presetCategory: item.categoryLabel
        }
    ])[0];
    assert.equal(record.presetId, 'watercolor-scene');
    assert.equal(record.presetCategory, '插画创作');
    assert.equal(normalizeHistory([{ images: [{ filename: 'old.png' }] }])[0].presetId, undefined);
});
