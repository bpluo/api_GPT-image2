'use client';

/* eslint-disable @next/next/no-img-element */
import { ImageOptions } from '@/components/image-options';
import { MaskEditor, type MaskEditorHandle } from '@/components/mask-editor';
import { PromptComposer } from '@/components/prompt-composer';
import { Button } from '@/components/ui/button';
import { useFilePreviews } from '@/hooks/use-file-previews';
import type { ImageRequest } from '@/lib/image-request';
import { MAX_EDIT_IMAGES, validateSettings, type ImageSettings } from '@/lib/image-settings';
import type { PromptTemplate } from '@/lib/preset-prompts';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, ImagePlus, Loader2, Pencil, X } from 'lucide-react';
import * as React from 'react';

export type EditingFormData = ImageSettings & { imageFiles: File[]; maskFile: File | null };

export function EditingForm({
    value,
    onChange,
    files,
    onAddFiles,
    onChangeFiles,
    onSubmit,
    disabled,
    isLoading,
    active,
    onPresetSelect
}: {
    value: ImageSettings;
    onChange: (patch: Partial<ImageSettings>) => void;
    files: File[];
    onAddFiles: (files: File[]) => void;
    onChangeFiles: (files: File[]) => void;
    onSubmit: (request: ImageRequest) => void;
    disabled: boolean;
    isLoading: boolean;
    active: boolean;
    onPresetSelect?: (preset: PromptTemplate | null) => void;
}) {
    const previews = useFilePreviews(files);
    const [dragging, setDragging] = React.useState(false);
    const [preparing, setPreparing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const fileInput = React.useRef<HTMLInputElement>(null);
    const mask = React.useRef<MaskEditorHandle>(null);
    const preparingRef = React.useRef(false);
    const firstUrl = files[0] ? previews.get(files[0]) : undefined;
    const invalid = validateSettings(value);
    const locked = disabled || preparing;

    React.useEffect(() => {
        if (!active || locked) return;
        const paste = (event: ClipboardEvent) => {
            if ((event.target as Element)?.closest?.('[role="dialog"]')) return;
            const images = Array.from(event.clipboardData?.items || [])
                .filter((item) => item.type.startsWith('image/'))
                .map((item) => item.getAsFile())
                .filter((file): file is File => !!file);
            if (images.length) {
                event.preventDefault();
                onAddFiles(images);
            }
        };
        window.addEventListener('paste', paste);
        return () => window.removeEventListener('paste', paste);
    }, [active, locked, onAddFiles]);

    return (
        <form
            aria-label='编辑图片'
            className='flex min-h-0 flex-1 flex-col'
            onSubmit={async (event) => {
                event.preventDefault();
                if (locked || invalid || files.length === 0 || preparingRef.current) return;
                preparingRef.current = true;
                setPreparing(true);
                setError(null);
                try {
                    const maskFile = (await mask.current?.getMask()) || null;
                    onSubmit({
                        mode: 'edit',
                        settings: { ...value, output_format: 'png', background: 'auto', moderation: 'auto' },
                        imageFiles: [...files],
                        maskFile
                    });
                } catch (cause) {
                    setError(cause instanceof Error ? cause.message : '遮罩准备失败，请重试。');
                } finally {
                    preparingRef.current = false;
                    setPreparing(false);
                }
            }}>
            <div className='space-y-5 p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto'>
                <div className='space-y-3'>
                    <div className='flex items-center justify-between text-sm'>
                        <span className='font-medium'>编辑素材</span>
                        <span className='text-muted-foreground text-xs'>
                            {files.length} / {MAX_EDIT_IMAGES} 张
                        </span>
                    </div>
                    <div
                        onDragOver={(event) => {
                            event.preventDefault();
                            if (!locked) setDragging(true);
                        }}
                        onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            setDragging(false);
                            if (!locked) onAddFiles(Array.from(event.dataTransfer.files));
                        }}
                        className={cn(
                            'rounded-xl border border-dashed transition-colors',
                            dragging ? 'border-primary bg-primary/10' : 'border-border bg-background/35'
                        )}>
                        <button
                            type='button'
                            disabled={locked || files.length >= MAX_EDIT_IMAGES}
                            onClick={() => fileInput.current?.click()}
                            className='focus-visible:ring-ring flex w-full flex-col items-center gap-2 rounded-xl px-4 py-5 text-sm focus-visible:ring-2 disabled:opacity-50'>
                            <ImagePlus className='text-primary h-5 w-5' />
                            <span>{files.length ? '继续添加参考图' : '点击上传，或将图片拖到这里'}</span>
                            <span className='text-muted-foreground text-xs'>
                                支持粘贴图片 · PNG / JPEG / WebP · 每张小于 50 MB
                            </span>
                        </button>
                        <input
                            ref={fileInput}
                            type='file'
                            multiple
                            accept='image/png,image/jpeg,image/webp'
                            aria-label='添加编辑图片'
                            disabled={locked}
                            className='sr-only'
                            onChange={(event) => {
                                onAddFiles(Array.from(event.currentTarget.files || []));
                                event.currentTarget.value = '';
                            }}
                        />
                    </div>
                    {files.length > 0 && (
                        <>
                            <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
                                {files.map((file, index) => (
                                    <div
                                        key={`${file.name}-${file.size}-${file.lastModified}`}
                                        className='border-border bg-background/40 relative min-w-0 rounded-lg border p-1'>
                                        {previews.get(file) && (
                                            <img
                                                src={previews.get(file)}
                                                alt={`编辑素材 ${index + 1}：${file.name}`}
                                                className='aspect-square w-full rounded object-cover'
                                            />
                                        )}
                                        <button
                                            type='button'
                                            disabled={locked}
                                            aria-label={`移除图片 ${index + 1}`}
                                            onClick={() => onChangeFiles(files.filter((_, i) => i !== index))}
                                            className='bg-background/90 text-foreground hover:bg-destructive absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full shadow-sm hover:text-white'>
                                            <X className='h-4 w-4' />
                                        </button>
                                        <p
                                            className='text-muted-foreground truncate px-1 pt-1 text-[10px]'
                                            title={file.name}>
                                            {file.name}
                                        </p>
                                        {index === 0 ? (
                                            <p className='text-primary px-1 py-1 text-[11px] font-medium'>底图</p>
                                        ) : (
                                            <button
                                                type='button'
                                                disabled={locked}
                                                onClick={() =>
                                                    onChangeFiles([file, ...files.filter((_, i) => i !== index)])
                                                }
                                                className='text-muted-foreground hover:text-primary flex items-center gap-1 px-1 py-1 text-[11px]'>
                                                <ArrowLeftRight className='h-3 w-3' />
                                                设为底图
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className='text-muted-foreground text-[11px] leading-5'>
                                第一张为底图，其余可作为参考。图片仅保留在本次页面中，刷新后需重新添加。
                            </p>
                        </>
                    )}
                </div>
                <PromptComposer
                    mode='edit'
                    value={value}
                    onChange={onChange}
                    disabled={locked}
                    onPresetSelect={onPresetSelect}
                />
                {firstUrl && <MaskEditor key={firstUrl} ref={mask} sourceUrl={firstUrl} disabled={locked} />}
                <ImageOptions mode='edit' value={value} onChange={onChange} disabled={locked} />
                {error && (
                    <p role='alert' className='text-destructive text-sm'>
                        {error}
                    </p>
                )}
            </div>
            <div className='border-border bg-card shrink-0 space-y-2 border-t p-4 sm:px-5'>
                <Button
                    type='submit'
                    disabled={locked || !!invalid || !files.length}
                    className='h-11 w-full rounded-xl text-sm font-semibold'>
                    {isLoading || preparing ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                        <Pencil className='h-4 w-4' />
                    )}
                    {preparing ? '正在准备选区…' : isLoading ? '正在编辑…' : `生成 ${value.n} 张编辑结果`}
                </Button>
                <p className='text-muted-foreground text-center text-[11px]'>
                    {!files.length ? '先添加要编辑的图片，再描述修改内容' : 'Ctrl / ⌘ + Enter 提交 · 选区会自动应用'}
                </p>
            </div>
        </form>
    );
}
