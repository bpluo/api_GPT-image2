'use client';

import { PromptTemplateDialog } from '@/components/prompt-template-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ImageMode, ImageSettings } from '@/lib/image-settings';
import { allPromptTemplates, type PromptTemplate } from '@/lib/preset-prompts';
import {
    appendPromptConstraints,
    createConstraintApplication,
    getPromptNotices,
    getPromptUndoPatch,
    promptConstraintSnippets,
    type PromptApplication
} from '@/lib/prompt-tools';
import { Check, ChevronDown, Copy, Layers3, Plus, Undo2 } from 'lucide-react';
import * as React from 'react';

export function PromptComposer({
    mode,
    value,
    onChange,
    disabled,
    onPresetSelect
}: {
    mode: ImageMode;
    value: ImageSettings;
    onChange: (patch: Partial<ImageSettings>) => void;
    disabled: boolean;
    onPresetSelect?: (preset: PromptTemplate | null) => void;
}) {
    const [libraryOpen, setLibraryOpen] = React.useState(false);
    const [initialTemplateId, setInitialTemplateId] = React.useState<string | undefined>();
    const [lastApplication, setLastApplication] = React.useState<{
        application: PromptApplication;
        previousPreset: PromptTemplate | null;
        label: string;
    } | null>(null);
    const [copyMessage, setCopyMessage] = React.useState<string | null>(null);
    const preset = React.useRef<{ prompt: string; template: PromptTemplate | null } | null>(null);
    const textarea = React.useRef<HTMLTextAreaElement>(null);
    const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const undoPatch = getPromptUndoPatch(value, lastApplication?.application || null);
    const notices = getPromptNotices(value.prompt);
    const quickIds =
        mode === 'generate'
            ? ['method-pipeline', 'product-hero', 'watercolor-scene']
            : ['replace-background', 'remove-object', 'scientific-refinement'];
    const quickTemplates = quickIds
        .map((id) => allPromptTemplates.find((template) => template.id === id))
        .filter((template): template is PromptTemplate => !!template);
    React.useEffect(
        () => () => {
            if (copyTimer.current) clearTimeout(copyTimer.current);
        },
        []
    );

    const openLibrary = (id?: string) => {
        setInitialTemplateId(id);
        setLibraryOpen(true);
    };
    const apply = (application: PromptApplication, template?: PromptTemplate) => {
        if (disabled || (application.kind === 'constraints' && !application.addedCount)) return;
        const previousPreset = preset.current?.prompt === value.prompt ? preset.current.template : null;
        const nextPreset = application.kind === 'replace' ? template || null : previousPreset;
        onChange(application.patch);
        preset.current = { prompt: application.patch.prompt!, template: nextPreset };
        onPresetSelect?.(nextPreset);
        setLastApplication({
            application,
            previousPreset,
            label:
                application.kind === 'replace'
                    ? `已填入“${template?.title || '模板'}”`
                    : `已补充 ${application.addedCount} 条约束`
        });
        setCopyMessage(null);
        window.requestAnimationFrame(() => textarea.current?.focus({ preventScroll: true }));
    };

    return (
        <div className='space-y-3'>
            <div className='flex items-center justify-between gap-2'>
                <Label htmlFor={`${mode}-prompt`} className='text-sm font-medium'>
                    {mode === 'generate' ? '想生成什么画面？' : '希望怎样修改图片？'}
                </Label>
                <span className='text-muted-foreground text-[11px] tabular-nums'>
                    {value.prompt.length.toLocaleString()} 字符
                </span>
            </div>
            <Textarea
                ref={textarea}
                id={`${mode}-prompt`}
                value={value.prompt}
                onChange={(event) => {
                    onChange({ prompt: event.target.value });
                    onPresetSelect?.(null);
                    preset.current = null;
                    setLastApplication(null);
                    setCopyMessage(null);
                }}
                disabled={disabled}
                required
                aria-describedby={`${mode}-prompt-guidance`}
                placeholder={
                    mode === 'generate'
                        ? '主体是什么？在什么场景中？希望呈现什么风格？\n例如：一只橘猫坐在咖啡馆窗边，暖色晨光，柔和的水彩插画。'
                        : '修改什么、在什么位置、其他哪些部分要保留？\n例如：将背景换成纯白，保留主体的形状、颜色和文字。'
                }
                className='bg-background/60 placeholder:text-muted-foreground/70 max-h-[340px] min-h-[160px] resize-y overflow-y-auto rounded-xl p-3 text-sm leading-6'
                onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                    }
                }}
            />
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={disabled}
                    onClick={() => openLibrary()}
                    className='rounded-lg'>
                    <Layers3 className='h-4 w-4' />
                    场景模板
                </Button>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    disabled={!value.prompt.trim()}
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(value.prompt);
                            setCopyMessage('已复制提示词');
                        } catch {
                            setCopyMessage('复制失败，可在输入框中手动选择并复制。');
                        }
                        if (copyTimer.current) clearTimeout(copyTimer.current);
                        copyTimer.current = setTimeout(() => setCopyMessage(null), 2500);
                    }}
                    aria-label='复制当前提示词'
                    className='text-muted-foreground'>
                    <Copy className='h-3.5 w-3.5' />
                    复制
                </Button>
            </div>
            <p id={`${mode}-prompt-guidance`} className='text-muted-foreground text-[11px] leading-5'>
                {mode === 'generate'
                    ? '先写主体、场景与风格；重要文案写明原文。也可以选模板，填几项就能开始。'
                    : '明确修改对象和位置，再说明要保留的内容。可用局部选区限制修改范围。'}
            </p>
            {!value.prompt.trim() && (
                <div className='flex flex-wrap gap-2'>
                    {quickTemplates.map((template) => (
                        <button
                            key={template.id}
                            type='button'
                            disabled={disabled}
                            onClick={() => openLibrary(template.id)}
                            className='border-border text-muted-foreground hover:border-primary/50 hover:text-primary rounded-full border px-3 py-1.5 text-xs transition'>
                            {template.title}
                        </button>
                    ))}
                </div>
            )}
            <details className='group/constraints border-border/60 bg-background/20 rounded-lg border'>
                <summary className='text-muted-foreground focus-visible:ring-ring flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs focus-visible:ring-2'>
                    补充绘图约束<span className='ml-auto text-[11px]'>按需添加</span>
                    <ChevronDown className='h-3.5 w-3.5 transition-transform group-open/constraints:rotate-180' />
                </summary>
                <div className='border-border/60 space-y-2 border-t px-3 py-3'>
                    <p className='text-muted-foreground text-[11px] leading-5'>
                        {value.prompt.trim()
                            ? '点击追加到末尾，已包含的约束会自动跳过。'
                            : '先写下画面或修改描述，再按需补充约束。'}
                    </p>
                    <div className='flex flex-wrap gap-2'>
                        {promptConstraintSnippets
                            .filter((snippet) => snippet.modes.includes(mode))
                            .map((snippet) => {
                                const included = appendPromptConstraints(value.prompt, [snippet.text]).addedCount === 0;
                                return (
                                    <button
                                        key={snippet.id}
                                        type='button'
                                        disabled={disabled || !value.prompt.trim() || included}
                                        title={snippet.text}
                                        onClick={() => apply(createConstraintApplication(value, [snippet.text]))}
                                        className='border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-primary flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs disabled:opacity-60'>
                                        {included ? (
                                            <Check className='text-primary h-3 w-3' />
                                        ) : (
                                            <Plus className='h-3 w-3' />
                                        )}
                                        {snippet.label}
                                    </button>
                                );
                            })}
                    </div>
                </div>
            </details>
            {notices.map((notice) => (
                <p key={notice} className='text-muted-foreground text-xs leading-5' role='status'>
                    {notice}
                </p>
            ))}
            {undoPatch && lastApplication && (
                <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs' role='status'>
                    <span>{lastApplication.label}</span>
                    <button
                        type='button'
                        disabled={disabled}
                        className='text-primary focus-visible:ring-ring inline-flex items-center gap-1 rounded hover:underline focus-visible:ring-2'
                        onClick={() => {
                            onChange(undoPatch);
                            onPresetSelect?.(lastApplication.previousPreset);
                            preset.current = { prompt: undoPatch.prompt!, template: lastApplication.previousPreset };
                            setLastApplication(null);
                        }}>
                        <Undo2 className='h-3.5 w-3.5' />
                        撤销本次应用
                    </button>
                </div>
            )}
            {copyMessage && (
                <p role='status' className='text-muted-foreground text-xs'>
                    {copyMessage}
                </p>
            )}
            <PromptTemplateDialog
                open={libraryOpen}
                onOpenChange={setLibraryOpen}
                mode={mode}
                current={value}
                disabled={disabled}
                initialTemplateId={initialTemplateId}
                onApply={apply}
            />
        </div>
    );
}
