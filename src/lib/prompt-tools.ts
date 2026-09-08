import type { ImageMode, ImageSettings } from './image-settings';
import type { PromptTemplate } from './preset-prompts';

export type PromptValues = Record<string, string>;
export type PromptLanguage = 'original' | 'zh' | 'en' | 'none';
export type PromptTemplateOptions = { language?: PromptLanguage; extra?: string };
export type PromptApplication = {
    patch: Partial<ImageSettings>;
    before: ImageSettings;
    kind: 'replace' | 'constraints';
    addedCount?: number;
};

const textRules: Record<PromptLanguage, string> = {
    original: '图中文字按提供的原文呈现；未提供文字时，不自行增加标语、签名或水印。',
    zh: '说明性标签使用简洁中文；明确提供的文案、数值和专有名词逐字保留。',
    en: '说明性标签使用简洁英文；明确提供的文案、数值和专有名词逐字保留。',
    none: '画面不包含文字、字母、数字、标志或水印。'
};

export function getTemplateExamples(template: PromptTemplate): PromptValues {
    return Object.fromEntries(template.fields.map((field) => [field.id, field.example]));
}

export function fillTemplateExamples(template: PromptTemplate, current: PromptValues): PromptValues {
    const values = { ...current };
    for (const field of template.fields) if (!values[field.id]?.trim()) values[field.id] = field.example;
    return values;
}

export function buildTemplatePrompt(
    template: PromptTemplate,
    values: PromptValues,
    options: PromptTemplateOptions = {}
) {
    const errors: Record<string, string> = {};
    const lines = [template.task];
    for (const field of template.fields) {
        const value = typeof values[field.id] === 'string' ? values[field.id].trim() : '';
        if (value) lines.push(`${field.label}：${value}`);
        else if (field.required) {
            errors[field.id] = `请填写${field.label}`;
            lines.push(`${field.label}：【请填写：${field.label}】`);
        }
    }
    const language = options.language || 'original';
    if (
        template.mode === 'generate' &&
        language === 'none' &&
        (template.categoryId === 'academic' ||
            template.categoryId === 'ui-ux' ||
            template.fields.some((field) => field.kind === 'copy' && (field.required || values[field.id]?.trim())))
    )
        errors.language = '此模板需要标签或已有文案，请选择保留原文、中文或英文。';
    const constraints = [...template.constraints];
    if (template.emptyFieldRule && !values[template.emptyFieldRule.field]?.trim())
        constraints.push(template.emptyFieldRule.instruction);
    constraints.push(
        template.mode === 'edit' ? '除明确给出的文字替换之外，保留原图文字的内容与语言。' : textRules[language]
    );
    lines.push(`\n画面要求：${template.composition}`);
    if (options.extra?.trim()) lines.push(`\n补充要求：${options.extra.trim()}`);
    lines.push(`\n绘图约束：\n${[...new Set(constraints)].map((rule) => `- ${rule}`).join('\n')}`);
    return { prompt: lines.join('\n'), errors, ready: Object.keys(errors).length === 0 };
}

const normalizeRule = (value: string) =>
    value
        .trim()
        .replace(/^[-*•]\s*/, '')
        .replace(/[。.!！]+$/, '')
        .replace(/\s+/g, ' ');

export function appendPromptConstraints(prompt: string, constraints: string[]) {
    const existing = new Set(prompt.split(/\r?\n/).map(normalizeRule));
    const added: string[] = [];
    for (const rule of constraints) {
        const key = normalizeRule(rule);
        if (key && !existing.has(key)) {
            added.push(rule.trim());
            existing.add(key);
        }
    }
    if (!added.length) return { prompt, addedCount: 0 };
    return {
        prompt: `${prompt.trimEnd()}\n\n补充约束：\n${added.map((rule) => `- ${rule}`).join('\n')}`,
        addedCount: added.length
    };
}

export function createTemplateApplication(
    current: ImageSettings,
    template: PromptTemplate,
    values: PromptValues,
    options: PromptTemplateOptions & { applyRecommended?: boolean } = {}
): PromptApplication {
    const result = buildTemplatePrompt(template, values, options);
    if (!result.ready) throw new Error(Object.values(result.errors).join('；'));
    const patch: Partial<ImageSettings> = { prompt: result.prompt };
    if (options.applyRecommended) {
        if (template.recommendedSize) patch.size = template.recommendedSize;
        if (template.recommendedQuality) patch.quality = template.recommendedQuality;
        if (template.mode === 'generate' && template.recommendedOutputFormat)
            patch.output_format = template.recommendedOutputFormat;
    }
    return { patch, before: { ...current }, kind: 'replace' };
}

export function createConstraintApplication(current: ImageSettings, constraints: string[]): PromptApplication {
    if (!current.prompt.trim()) throw new Error('请先填写画面或修改描述，再补充绘图约束。');
    const result = appendPromptConstraints(current.prompt, constraints);
    return {
        patch: { prompt: result.prompt },
        before: { ...current },
        kind: 'constraints',
        addedCount: result.addedCount
    };
}

export function getPromptUndoPatch(
    current: ImageSettings,
    application: PromptApplication | null
): Partial<ImageSettings> | null {
    if (!application || current.prompt !== application.patch.prompt) return null;
    const patch: Partial<ImageSettings> = { prompt: application.before.prompt };
    // 只撤回本次应用且仍未被用户另行更改的参数。
    for (const key of ['size', 'quality', 'output_format'] as const) {
        if (key in application.patch && current[key] === application.patch[key])
            Object.assign(patch, { [key]: application.before[key] });
    }
    return patch;
}

export const promptConstraintSnippets: { id: string; label: string; text: string; modes: ImageMode[] }[] = [
    {
        id: 'literal-text',
        label: '文字准确',
        text: '明确给出的文字、数字和专有名词逐字保留，不自行改写或翻译。',
        modes: ['generate', 'edit']
    },
    {
        id: 'no-watermark',
        label: '不加水印',
        text: '不添加未指定的水印、签名、标志或装饰性文字。',
        modes: ['generate', 'edit']
    },
    {
        id: 'safe-margin',
        label: '留足边距',
        text: '主体和文字完整入画，四周留有安全边距，避免裁切和遮挡。',
        modes: ['generate', 'edit']
    },
    {
        id: 'faithful-data',
        label: '不编造数据',
        text: '仅使用提供的数据和结论，不添加虚构数值、排名或统计标记。',
        modes: ['generate', 'edit']
    },
    {
        id: 'clear-focus',
        label: '突出主体',
        text: '设置明确的视觉焦点，区分主次信息，减少无关装饰。',
        modes: ['generate']
    },
    {
        id: 'edit-scope',
        label: '保留其他部分',
        text: '只修改指定区域与内容，其余主体、构图、比例和细节保持原样。',
        modes: ['edit']
    }
];

export function getPromptNotices(prompt: string): string[] {
    if (!prompt.trim()) return [];
    const notices: string[] = [];
    if (/【请填写：[^】]+】/.test(prompt)) notices.push('提示词中还有未填写项，补全后再生成会更明确。');
    if (prompt.length > 6000) notices.push('提示词较长，可以检查并删除重复要求，把最重要的内容放在前面。');
    return notices;
}
