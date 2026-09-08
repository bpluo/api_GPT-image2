'use client';

import { ImageOptions } from '@/components/image-options';
import { PromptComposer } from '@/components/prompt-composer';
import { Button } from '@/components/ui/button';
import type { ImageRequest } from '@/lib/image-request';
import { validateSettings, type ImageSettings } from '@/lib/image-settings';
import type { PromptTemplate } from '@/lib/preset-prompts';
import { Loader2, Sparkles } from 'lucide-react';

export type GenerationFormData = ImageSettings;

export function GenerationForm({
    value,
    onChange,
    onSubmit,
    disabled,
    isLoading,
    onPresetSelect
}: {
    value: ImageSettings;
    onChange: (patch: Partial<ImageSettings>) => void;
    onSubmit: (request: ImageRequest) => void;
    disabled: boolean;
    isLoading: boolean;
    onPresetSelect?: (preset: PromptTemplate | null) => void;
}) {
    const invalid = validateSettings(value);
    return (
        <form
            aria-label='生成图片'
            className='flex min-h-0 flex-1 flex-col'
            onSubmit={(event) => {
                event.preventDefault();
                if (!disabled && !invalid) onSubmit({ mode: 'generate', settings: { ...value } });
            }}>
            <div className='space-y-6 p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto'>
                <PromptComposer
                    mode='generate'
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    onPresetSelect={onPresetSelect}
                />
                <ImageOptions mode='generate' value={value} onChange={onChange} disabled={disabled} />
            </div>
            <div className='border-border bg-card shrink-0 space-y-2 border-t p-4 sm:px-5'>
                <Button
                    type='submit'
                    disabled={disabled || !!invalid}
                    className='h-11 w-full rounded-xl text-sm font-semibold'>
                    {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Sparkles className='h-4 w-4' />}
                    {isLoading ? '正在生成…' : `生成 ${value.n} 张图片`}
                </Button>
                <p className='text-muted-foreground text-center text-[11px]'>
                    {!value.prompt.trim()
                        ? '写下画面描述，或选择场景模板开始'
                        : 'Ctrl / ⌘ + Enter 提交 · 提示词与参数自动保存'}
                </p>
            </div>
        </form>
    );
}
