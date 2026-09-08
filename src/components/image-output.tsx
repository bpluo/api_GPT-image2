'use client';

/* eslint-disable @next/next/no-img-element */
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { HistoryMetadata } from '@/lib/history';
import { cn } from '@/lib/utils';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    Grid2X2,
    ImageIcon,
    ImageOff,
    Loader2,
    Maximize2,
    Pencil,
    Square
} from 'lucide-react';
import * as React from 'react';

export type DisplayImage = { filename: string; path: string };

export function ImageOutput({
    images,
    selected,
    view,
    onViewChange,
    phase,
    elapsedSeconds,
    previews,
    onCancel,
    onSendToEdit,
    onCompose,
    disabled
}: {
    images: DisplayImage[];
    selected: HistoryMetadata | null;
    view: 'grid' | number;
    onViewChange: (view: 'grid' | number) => void;
    phase: 'idle' | 'requesting' | 'saving';
    elapsedSeconds: number;
    previews: Map<number, string>;
    onCancel: () => void;
    onSendToEdit: (image: DisplayImage) => void;
    onCompose: () => void;
    disabled: boolean;
}) {
    const [failed, setFailed] = React.useState(new Set<string>());
    const [enlarged, setEnlarged] = React.useState(false);
    React.useEffect(() => {
        setFailed(new Set());
        setEnlarged(false);
    }, [images]);
    const running = phase !== 'idle';
    const image = typeof view === 'number' ? images[view] : undefined;
    const available = !!image && !failed.has(image.path);
    const latestPreview = Array.from(previews.values()).at(-1);
    const renderImage = (item: DisplayImage, className: string) =>
        failed.has(item.path) ? (
            <div className='text-muted-foreground flex h-full min-h-32 flex-col items-center justify-center gap-2'>
                <ImageOff className='h-6 w-6' />
                <p className='text-sm'>图片无法读取</p>
                <p className='px-4 text-center text-xs'>文件可能已被移动或删除，历史参数仍可复用。</p>
            </div>
        ) : (
            <img
                src={item.path}
                alt={selected?.prompt || '创作结果'}
                className={className}
                onError={() => setFailed((current) => new Set(current).add(item.path))}
            />
        );

    return (
        <section
            aria-label='图片预览'
            aria-busy={running}
            className='border-border bg-card flex min-h-[400px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border p-3 sm:p-4'>
            <div className='mb-3 flex shrink-0 items-center justify-between gap-2'>
                <div>
                    <h2 className='text-sm font-semibold'>作品预览</h2>
                    <p className='text-muted-foreground mt-1 text-xs'>
                        {running
                            ? phase === 'saving'
                                ? '图片已生成，正在保存'
                                : '正在创作，请稍候'
                            : images.length
                              ? `${images.length} 张图片 · ${selected?.mode === 'edit' ? '编辑结果' : '生成结果'}`
                              : '从一个想法开始'}
                    </p>
                </div>
                {images.length > 0 && !running && (
                    <span className='border-border text-muted-foreground rounded-full border px-2 py-1 text-[11px]'>
                        {selected?.output_format?.toUpperCase() || 'PNG'}
                    </span>
                )}
            </div>
            <div className='preview-canvas border-border/70 relative flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border lg:min-h-0'>
                {running ? (
                    <div className='relative flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-3 p-5 text-center'>
                        {latestPreview && (
                            <img
                                src={latestPreview}
                                alt='生成中的预览'
                                className='absolute inset-0 h-full w-full object-contain p-3'
                            />
                        )}
                        <div
                            className={cn(
                                'relative flex flex-col items-center rounded-2xl p-5',
                                latestPreview && 'bg-background/90 mt-auto shadow-lg backdrop-blur'
                            )}>
                            <Loader2 className='text-primary mb-3 h-7 w-7 animate-spin' />
                            <p role='status' className='text-sm font-medium'>
                                {phase === 'saving'
                                    ? '正在保存图片'
                                    : latestPreview
                                      ? '画面正在逐步细化'
                                      : '正在将你的想法变成图片'}
                            </p>
                            <p className='text-muted-foreground mt-2 text-xs tabular-nums'>
                                已等待 {elapsedSeconds} 秒
                            </p>
                            <p className='text-muted-foreground mt-1 max-w-xs text-xs leading-5'>
                                {elapsedSeconds >= 60
                                    ? '高质量或多张图片可能需要更久，你可以继续等待或停止。'
                                    : '完成后会自动展示，并保存到历史记录。'}
                            </p>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                disabled={phase === 'saving'}
                                onClick={onCancel}
                                className='mt-4 rounded-full'>
                                <Square className='h-3 w-3' />
                                停止等待
                            </Button>
                        </div>
                    </div>
                ) : images.length ? (
                    view === 'grid' ? (
                        <div className='grid h-full max-h-[650px] w-full grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 lg:max-h-full'>
                            {images.map((item, index) => (
                                <button
                                    key={item.filename}
                                    type='button'
                                    aria-label={`查看第 ${index + 1} 张图片`}
                                    onClick={() => onViewChange(index)}
                                    className='border-border bg-background/60 hover:border-primary focus-visible:ring-ring relative aspect-square overflow-hidden rounded-lg border transition focus-visible:ring-2'>
                                    {renderImage(item, 'h-full w-full object-contain')}
                                    <span className='bg-background/80 absolute right-1 bottom-1 rounded px-1.5 py-0.5 text-[10px]'>
                                        {index + 1}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : image ? (
                        <button
                            type='button'
                            onClick={() => setEnlarged(true)}
                            disabled={!available}
                            className='focus-visible:ring-ring flex h-full w-full items-center justify-center rounded-xl focus-visible:ring-2'
                            aria-label='放大查看图片'>
                            {renderImage(image, 'max-h-[65vh] max-w-full object-contain p-3 lg:max-h-full')}
                        </button>
                    ) : null
                ) : (
                    <div className='flex max-w-sm flex-col items-center px-6 py-10 text-center'>
                        <div className='border-primary/20 bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border'>
                            <ImageIcon className='h-7 w-7' />
                        </div>
                        <h3 className='text-lg font-medium'>让想法有画面</h3>
                        <p className='text-muted-foreground mt-2 text-sm leading-6'>
                            输入描述即可生成图片；也可以上传素材，在原图上继续创作。
                        </p>
                        <Button type='button' variant='outline' onClick={onCompose} className='mt-5 rounded-full'>
                            开始创作
                        </Button>
                    </div>
                )}
            </div>
            {!!images.length && !running && (
                <div className='mt-3 space-y-3'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        {images.length > 1 && (
                            <div className='border-border flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border p-1'>
                                <Button
                                    type='button'
                                    variant={view === 'grid' ? 'secondary' : 'ghost'}
                                    size='icon'
                                    className='h-8 w-8 shrink-0'
                                    aria-label='显示全部图片'
                                    onClick={() => onViewChange('grid')}>
                                    <Grid2X2 className='h-4 w-4' />
                                </Button>
                                {images.map((item, index) => (
                                    <button
                                        key={item.filename}
                                        type='button'
                                        aria-label={`选择第 ${index + 1} 张图片`}
                                        aria-pressed={view === index}
                                        className={cn(
                                            'h-8 min-w-8 rounded text-xs',
                                            view === index
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-muted'
                                        )}
                                        onClick={() => onViewChange(index)}>
                                        {index + 1}
                                    </button>
                                ))}
                            </div>
                        )}
                        {available && (
                            <div className='ml-auto flex flex-wrap items-center gap-2'>
                                <Button asChild variant='outline' size='sm'>
                                    <a href={image.path} download={image.filename}>
                                        <Download className='h-4 w-4' />
                                        下载图片
                                    </a>
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='icon'
                                    className='h-9 w-9'
                                    aria-label='放大图片'
                                    onClick={() => setEnlarged(true)}>
                                    <Maximize2 className='h-4 w-4' />
                                </Button>
                                <Button type='button' size='sm' disabled={disabled} onClick={() => onSendToEdit(image)}>
                                    <Pencil className='h-4 w-4' />
                                    作为底图编辑
                                </Button>
                            </div>
                        )}
                        {view === 'grid' && <p className='text-muted-foreground text-xs'>点选图片可下载或继续编辑</p>}
                    </div>
                    {selected && (
                        <div className='border-border/60 text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-[11px]'>
                            <span>{selected.model}</span>
                            <span>{(selected.durationMs / 1000).toFixed(1)} 秒</span>
                            <span>
                                {selected.costDetails
                                    ? `估算 $${selected.costDetails.estimated_cost_usd.toFixed(4)}`
                                    : '费用信息未提供'}
                            </span>
                        </div>
                    )}
                </div>
            )}
            <Dialog open={enlarged} onOpenChange={setEnlarged}>
                <DialogContent className='flex max-h-[95dvh] flex-col sm:max-w-[90vw]'>
                    <DialogHeader>
                        <DialogTitle>图片预览</DialogTitle>
                        <DialogDescription>
                            {typeof view === 'number' ? `第 ${view + 1} 张，共 ${images.length} 张` : '创作结果'}
                        </DialogDescription>
                    </DialogHeader>
                    {image && renderImage(image, 'min-h-0 max-w-full flex-1 object-contain max-h-[72dvh]')}
                    <div className='flex flex-wrap items-center justify-center gap-3'>
                        {images.length > 1 && typeof view === 'number' && (
                            <>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    disabled={view === 0}
                                    onClick={() => onViewChange(view - 1)}>
                                    <ChevronLeft className='h-4 w-4' />
                                    上一张
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    disabled={view === images.length - 1}
                                    onClick={() => onViewChange(view + 1)}>
                                    下一张
                                    <ChevronRight className='h-4 w-4' />
                                </Button>
                            </>
                        )}
                        {available && (
                            <Button asChild size='sm'>
                                <a href={image.path} download={image.filename}>
                                    <Download className='h-4 w-4' />
                                    下载原图
                                </a>
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
