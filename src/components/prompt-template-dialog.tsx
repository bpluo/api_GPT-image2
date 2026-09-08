'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ImageMode, ImageSettings } from '@/lib/image-settings';
import { findPromptTemplates, getPromptCategoriesForMode, type PromptTemplate } from '@/lib/preset-prompts';
import {
    appendPromptConstraints,
    buildTemplatePrompt,
    createConstraintApplication,
    createTemplateApplication,
    fillTemplateExamples,
    type PromptApplication,
    type PromptLanguage,
    type PromptValues
} from '@/lib/prompt-tools';
import { cn } from '@/lib/utils';
import { ArrowDownToLine, Check, CheckCircle2, Copy, FileText, Info, Layers3, Search, X } from 'lucide-react';
import * as React from 'react';

export function PromptTemplateDialog({
    open,
    onOpenChange,
    mode,
    current,
    disabled,
    initialTemplateId,
    onApply
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: ImageMode;
    current: ImageSettings;
    disabled: boolean;
    initialTemplateId?: string;
    onApply: (application: PromptApplication, template: PromptTemplate) => void;
}) {
    const [query, setQuery] = React.useState('');
    const [categoryId, setCategoryId] = React.useState('all');
    const [selectedId, setSelectedId] = React.useState('');
    const [drafts, setDrafts] = React.useState<Record<string, PromptValues>>({});
    const [extras, setExtras] = React.useState<Record<string, string>>({});
    const [languages, setLanguages] = React.useState<Record<string, PromptLanguage>>({});
    const [ruleSelections, setRuleSelections] = React.useState<Record<string, number[]>>({});
    const [action, setAction] = React.useState<'replace' | 'constraints'>('replace');
    const [applyRecommended, setApplyRecommended] = React.useState(false);
    const [message, setMessage] = React.useState<string | null>(null);
    const [exampleUndo, setExampleUndo] = React.useState<{ id: string; values: PromptValues } | null>(null);
    const detailRef = React.useRef<HTMLDivElement>(null);
    const categories = React.useMemo(() => getPromptCategoriesForMode(mode), [mode]);
    const templates = React.useMemo(() => findPromptTemplates(mode, query, categoryId), [mode, query, categoryId]);
    const template = templates.find((item) => item.id === selectedId) || templates[0];
    const values = template ? drafts[template.id] || {} : {};
    const language = template ? languages[template.id] || 'original' : 'original';
    const extra = template ? extras[template.id] || '' : '';
    const rendered = template ? buildTemplatePrompt(template, values, { language, extra }) : null;
    const selectedRules = template ? ruleSelections[template.id] || template.constraints.map((_, index) => index) : [];
    const rules = template ? template.constraints.filter((_, index) => selectedRules.includes(index)) : [];
    const appended = appendPromptConstraints(current.prompt, rules);
    const preview = action === 'replace' ? rendered?.prompt || '' : appended.prompt;
    const ready = action === 'replace' ? rendered?.ready : !!current.prompt.trim() && appended.addedCount > 0;

    React.useEffect(() => {
        if (open) {
            setQuery('');
            setCategoryId('all');
            setAction('replace');
            setApplyRecommended(false);
            setMessage(null);
            if (initialTemplateId) {
                setSelectedId(initialTemplateId);
                if (window.matchMedia('(max-width: 1023px)').matches) {
                    const frame = window.requestAnimationFrame(() =>
                        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    );
                    return () => window.cancelAnimationFrame(frame);
                }
            }
        }
    }, [open, initialTemplateId]);
    React.useEffect(() => {
        setMessage(null);
    }, [template?.id, action, preview]);
    React.useEffect(() => {
        if (templates.length && !templates.some((item) => item.id === selectedId)) setSelectedId(templates[0].id);
    }, [templates, selectedId]);

    const updateField = (id: string, text: string) => {
        if (!template) return;
        setDrafts((previous) => ({ ...previous, [template.id]: { ...previous[template.id], [id]: text } }));
        setExampleUndo(null);
    };
    const selectTemplate = (id: string) => {
        setSelectedId(id);
        if (window.matchMedia('(max-width: 1023px)').matches) {
            window.requestAnimationFrame(() =>
                detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            );
        }
    };
    const apply = () => {
        if (!template || disabled || !ready) return;
        try {
            const application =
                action === 'replace'
                    ? createTemplateApplication(current, template, values, { language, extra, applyRecommended })
                    : createConstraintApplication(current, rules);
            onApply(application, template);
            onOpenChange(false);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '模板应用失败，请检查填写内容。');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='flex h-[min(880px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1120px] sm:p-0'>
                <DialogHeader className='border-border shrink-0 border-b px-5 py-4 pr-12 text-left'>
                    <DialogTitle className='flex items-center gap-2'>
                        <Layers3 className='text-primary h-5 w-5' />
                        模板库
                        <span className='bg-muted text-muted-foreground ml-1 rounded-full px-2 py-1 text-xs font-normal'>
                            {mode === 'generate' ? '生成图片' : '编辑图片'}
                        </span>
                    </DialogTitle>
                    <DialogDescription>选择场景，填入你的内容，预览后再应用。模板不会直接发起生成。</DialogDescription>
                </DialogHeader>
                <div className='grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden'>
                    <aside
                        aria-label='选择模板'
                        className='border-border bg-muted/15 flex min-h-0 flex-col gap-3 border-b p-3 lg:border-r lg:border-b-0'>
                        <div className='relative'>
                            <Search className='text-muted-foreground pointer-events-none absolute top-3 left-3 h-4 w-4' />
                            <Input
                                aria-label='搜索模板'
                                placeholder='搜索场景或关键词'
                                value={query}
                                disabled={disabled}
                                onChange={(event) => setQuery(event.target.value)}
                                className='bg-background h-10 pr-9 pl-9'
                            />
                            {query && (
                                <button
                                    type='button'
                                    aria-label='清除模板搜索'
                                    onClick={() => setQuery('')}
                                    className='text-muted-foreground absolute top-1 right-1 h-8 w-8 rounded p-2'>
                                    <X className='h-4 w-4' />
                                </button>
                            )}
                        </div>
                        <select
                            aria-label='模板分类'
                            disabled={disabled}
                            className='border-input bg-background h-10 w-full rounded-lg border px-3 text-sm'
                            value={categoryId}
                            onChange={(event) => setCategoryId(event.target.value)}>
                            <option value='all'>
                                全部分类 · {categories.reduce((count, category) => count + category.prompts.length, 0)}
                            </option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.label} · {category.prompts.length}
                                </option>
                            ))}
                        </select>
                        <p className='text-muted-foreground px-1 text-[11px]' role='status'>
                            找到 {templates.length} 个适用模板
                        </p>
                        <div className='max-h-44 space-y-1.5 overflow-y-auto pr-1 lg:max-h-none lg:flex-1'>
                            {templates.map((item) => (
                                <button
                                    key={item.id}
                                    type='button'
                                    disabled={disabled}
                                    aria-pressed={template?.id === item.id}
                                    onClick={() => selectTemplate(item.id)}
                                    className={cn(
                                        'focus-visible:ring-ring w-full rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 disabled:opacity-50',
                                        template?.id === item.id
                                            ? 'border-primary/50 bg-primary/10'
                                            : 'hover:border-border hover:bg-background border-transparent'
                                    )}>
                                    <span className='flex items-center justify-between gap-2 text-sm font-medium'>
                                        <span>{item.title}</span>
                                        {template?.id === item.id && (
                                            <Check className='text-primary h-4 w-4 shrink-0' />
                                        )}
                                    </span>
                                    <span className='text-muted-foreground mt-1 block text-[11px]'>
                                        {item.categoryLabel}
                                    </span>
                                    <span className='text-muted-foreground mt-1 block text-xs leading-5'>
                                        {item.description}
                                    </span>
                                </button>
                            ))}
                            {!templates.length && (
                                <div className='text-muted-foreground py-6 text-center text-sm'>
                                    <p>没有匹配的模板</p>
                                    <Button
                                        type='button'
                                        variant='link'
                                        onClick={() => {
                                            setQuery('');
                                            setCategoryId('all');
                                        }}>
                                        清除筛选
                                    </Button>
                                </div>
                            )}
                        </div>
                    </aside>
                    <div ref={detailRef} className='min-w-0 scroll-mt-3 p-4 sm:p-5 lg:overflow-y-auto'>
                        {template ? (
                            <>
                                <div className='space-y-2'>
                                    <h3 className='text-lg font-semibold'>{template.title}</h3>
                                    <p className='text-muted-foreground text-sm leading-6'>{template.description}</p>
                                    <div className='flex flex-wrap gap-1.5'>
                                        {template.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className='border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]'>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {template.note && (
                                    <p className='bg-primary/5 text-muted-foreground mt-3 flex items-start gap-2 rounded-lg p-3 text-xs leading-5'>
                                        <Info className='text-primary mt-0.5 h-3.5 w-3.5 shrink-0' />
                                        {template.note}
                                    </p>
                                )}
                                <div
                                    role='group'
                                    aria-label='模板使用方式'
                                    className='border-border bg-background/45 my-4 flex gap-1 rounded-xl border p-1'>
                                    <button
                                        type='button'
                                        disabled={disabled}
                                        aria-pressed={action === 'replace'}
                                        onClick={() => setAction('replace')}
                                        className={cn(
                                            'min-h-10 flex-1 rounded-lg px-2 text-sm',
                                            action === 'replace'
                                                ? 'bg-primary/15 text-primary font-medium'
                                                : 'text-muted-foreground'
                                        )}>
                                        填入完整模板
                                    </button>
                                    <button
                                        type='button'
                                        disabled={disabled || !current.prompt.trim()}
                                        title={!current.prompt.trim() ? '先在工作台填写描述，再补充规范' : undefined}
                                        aria-pressed={action === 'constraints'}
                                        onClick={() => setAction('constraints')}
                                        className={cn(
                                            'min-h-10 flex-1 rounded-lg px-2 text-sm disabled:opacity-40',
                                            action === 'constraints'
                                                ? 'bg-primary/15 text-primary font-medium'
                                                : 'text-muted-foreground'
                                        )}>
                                        只补充规范
                                    </button>
                                </div>
                                <div className='grid gap-5 lg:grid-cols-2'>
                                    <div className='min-w-0 space-y-4'>
                                        {action === 'replace' ? (
                                            <>
                                                <div className='flex flex-wrap gap-2'>
                                                    <Button
                                                        type='button'
                                                        variant='outline'
                                                        size='sm'
                                                        disabled={disabled}
                                                        onClick={() => {
                                                            setExampleUndo({ id: template.id, values: { ...values } });
                                                            setDrafts((previous) => ({
                                                                ...previous,
                                                                [template.id]: fillTemplateExamples(template, values)
                                                            }));
                                                        }}>
                                                        {Object.values(values).some((text) => text.trim())
                                                            ? '补充示例'
                                                            : '填入示例'}
                                                    </Button>
                                                    {current.prompt.trim() && (
                                                        <Button
                                                            type='button'
                                                            variant='ghost'
                                                            size='sm'
                                                            disabled={disabled}
                                                            onClick={() =>
                                                                updateField(template.fields[0].id, current.prompt)
                                                            }>
                                                            <ArrowDownToLine className='h-3.5 w-3.5' />
                                                            带入当前内容
                                                        </Button>
                                                    )}
                                                </div>
                                                {exampleUndo?.id === template.id && (
                                                    <p className='text-muted-foreground text-xs leading-5'>
                                                        示例仅演示填写方式，请替换成自己的材料。
                                                        <button
                                                            type='button'
                                                            disabled={disabled}
                                                            className='text-primary ml-1 hover:underline'
                                                            onClick={() => {
                                                                setDrafts((previous) => ({
                                                                    ...previous,
                                                                    [template.id]: exampleUndo.values
                                                                }));
                                                                setExampleUndo(null);
                                                            }}>
                                                            撤销示例
                                                        </button>
                                                    </p>
                                                )}
                                                {template.fields.map((field) => (
                                                    <div key={field.id} className='space-y-2'>
                                                        <Label
                                                            htmlFor={`${mode}-${template.id}-${field.id}`}
                                                            className='flex flex-wrap items-center gap-1 text-sm'>
                                                            {field.label}
                                                            <span className='text-muted-foreground text-[11px] font-normal'>
                                                                {field.required ? '必填' : '选填'}
                                                            </span>
                                                        </Label>
                                                        <Textarea
                                                            id={`${mode}-${template.id}-${field.id}`}
                                                            disabled={disabled}
                                                            value={values[field.id] || ''}
                                                            onChange={(event) =>
                                                                updateField(field.id, event.target.value)
                                                            }
                                                            aria-required={!!field.required}
                                                            placeholder={field.placeholder || `例如：${field.example}`}
                                                            className='bg-background/50 field-sizing-fixed min-h-[78px] resize-y text-sm leading-6'
                                                        />
                                                    </div>
                                                ))}
                                                {mode === 'generate' && (
                                                    <div className='space-y-2'>
                                                        <Label htmlFor={`${mode}-template-language`}>图中文字</Label>
                                                        <select
                                                            id={`${mode}-template-language`}
                                                            disabled={disabled}
                                                            value={language}
                                                            onChange={(event) =>
                                                                setLanguages((previous) => ({
                                                                    ...previous,
                                                                    [template.id]: event.target.value as PromptLanguage
                                                                }))
                                                            }
                                                            className='border-input bg-background h-10 w-full rounded-lg border px-3 text-sm'>
                                                            <option value='original'>按提供的原文</option>
                                                            <option value='zh'>说明性标签用中文</option>
                                                            <option value='en'>说明性标签用英文</option>
                                                            <option value='none'>不添加文字</option>
                                                        </select>
                                                        {rendered?.errors.language && (
                                                            <p
                                                                role='alert'
                                                                className='text-destructive text-xs leading-5'>
                                                                {rendered.errors.language}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                <div className='space-y-2'>
                                                    <Label htmlFor={`${mode}-template-extra`}>
                                                        额外要求
                                                        <span className='text-muted-foreground ml-1 text-[11px] font-normal'>
                                                            选填
                                                        </span>
                                                    </Label>
                                                    <Textarea
                                                        id={`${mode}-template-extra`}
                                                        disabled={disabled}
                                                        value={extra}
                                                        onChange={(event) =>
                                                            setExtras((previous) => ({
                                                                ...previous,
                                                                [template.id]: event.target.value
                                                            }))
                                                        }
                                                        placeholder='例如：主体靠右、左侧留出标题区，避免使用红绿色对比。'
                                                        className='bg-background/50 field-sizing-fixed min-h-[78px] resize-y text-sm'
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className='text-muted-foreground text-sm leading-6'>
                                                    保留现有描述，把选中的绘图规范追加到末尾。重复的规范会自动跳过。
                                                </p>
                                                {template.constraints.map((rule, index) => (
                                                    <label
                                                        key={rule}
                                                        htmlFor={`${mode}-${template.id}-rule-${index}`}
                                                        className='border-border flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs leading-6'>
                                                        <Checkbox
                                                            id={`${mode}-${template.id}-rule-${index}`}
                                                            disabled={disabled}
                                                            checked={selectedRules.includes(index)}
                                                            className='mt-1 shrink-0'
                                                            onCheckedChange={(checked) =>
                                                                setRuleSelections((previous) => ({
                                                                    ...previous,
                                                                    [template.id]: checked
                                                                        ? [...selectedRules, index]
                                                                        : selectedRules.filter((item) => item !== index)
                                                                }))
                                                            }
                                                        />
                                                        <span>{rule}</span>
                                                    </label>
                                                ))}
                                                {appended.addedCount === 0 && (
                                                    <p className='text-muted-foreground text-xs'>
                                                        {selectedRules.length
                                                            ? '所选规范已包含在当前提示词中。'
                                                            : '至少选择一条规范后再追加。'}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className='min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start'>
                                        <div className='flex items-center justify-between gap-2'>
                                            <Label
                                                htmlFor={`${mode}-template-preview`}
                                                className='flex items-center gap-2'>
                                                <FileText className='text-primary h-4 w-4' />
                                                {action === 'replace' ? '提示词预览' : '追加后的提示词'}
                                            </Label>
                                            <span className='text-muted-foreground text-[11px]'>
                                                {preview.length.toLocaleString()} 字符
                                            </span>
                                        </div>
                                        <Textarea
                                            id={`${mode}-template-preview`}
                                            readOnly
                                            value={preview}
                                            className='bg-background/50 field-sizing-fixed h-[min(380px,42dvh)] min-h-48 resize-y text-xs leading-6'
                                        />
                                        {action === 'replace' && !rendered?.ready && (
                                            <p className='text-muted-foreground text-xs leading-5'>
                                                补全必填内容后即可应用；占位提示不会作为成品提示词填入。
                                            </p>
                                        )}
                                        {action === 'replace' && (
                                            <div className='border-border space-y-2 rounded-xl border p-3'>
                                                <label
                                                    htmlFor={`${mode}-apply-template-settings`}
                                                    className='flex cursor-pointer items-start gap-2 text-xs leading-5'>
                                                    <Checkbox
                                                        id={`${mode}-apply-template-settings`}
                                                        disabled={disabled}
                                                        checked={applyRecommended}
                                                        onCheckedChange={(checked) =>
                                                            setApplyRecommended(checked === true)
                                                        }
                                                        className='mt-0.5 shrink-0'
                                                    />
                                                    <span>同时应用推荐参数</span>
                                                </label>
                                                <p className='text-muted-foreground pl-6 text-[11px] leading-5'>
                                                    {
                                                        {
                                                            auto: '自动尺寸',
                                                            square: '正方形',
                                                            landscape: '横向',
                                                            portrait: '纵向'
                                                        }[template.recommendedSize || 'auto']
                                                    }{' '}
                                                    ·{' '}
                                                    {
                                                        {
                                                            auto: '自动质量',
                                                            low: '低质量',
                                                            medium: '中等质量',
                                                            high: '高质量'
                                                        }[template.recommendedQuality || 'auto']
                                                    }
                                                    {mode === 'generate' &&
                                                        ` · ${template.recommendedOutputFormat?.toUpperCase() || 'PNG'}`}
                                                </p>
                                                <p className='text-muted-foreground pl-6 text-[11px] leading-5'>
                                                    {applyRecommended
                                                        ? '高质量与较大尺寸通常需要更多时间和费用。'
                                                        : '当前选择：仅更新提示词。'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className='text-muted-foreground flex min-h-44 flex-col items-center justify-center gap-3 text-center'>
                                <Search className='h-6 w-6' />
                                <p className='text-sm'>换个关键词，或选择其他分类。</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className='border-border bg-background shrink-0 space-y-2 border-t px-4 py-3 sm:px-5'>
                    {message && (
                        <p role='status' className='text-muted-foreground text-xs leading-5'>
                            {message}
                        </p>
                    )}
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                            {ready ? (
                                <>
                                    <CheckCircle2 className='text-primary h-3.5 w-3.5' />
                                    {action === 'replace'
                                        ? current.prompt.trim()
                                            ? '应用后会替换当前提示词，可撤销'
                                            : '准备好后填入工作台'
                                        : `将补充 ${appended.addedCount} 条规范`}
                                </>
                            ) : action === 'replace' && rendered ? (
                                Object.values(rendered.errors).join('；')
                            ) : (
                                '选择模板并填写内容'
                            )}
                        </p>
                        <div className='ml-auto flex flex-wrap gap-2'>
                            <Button type='button' size='sm' variant='ghost' onClick={() => onOpenChange(false)}>
                                取消
                            </Button>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={!ready || disabled}
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(preview);
                                        setMessage('已复制预览中的完整提示词。');
                                    } catch {
                                        setMessage('复制失败，可在预览区域选中文字后手动复制。');
                                    }
                                }}>
                                <Copy className='h-3.5 w-3.5' />
                                复制
                            </Button>
                            <Button type='button' size='sm' disabled={!ready || disabled} onClick={apply}>
                                {action === 'replace' ? '填入提示词' : `追加 ${appended.addedCount} 条规范`}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
