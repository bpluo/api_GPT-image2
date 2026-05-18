'use client';

/* eslint-disable @next/next/no-img-element */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Grid, ImageIcon, Loader2, Send } from 'lucide-react';

type ImageInfo = {
    path: string;
    filename: string;
};

type ImageOutputProps = {
    imageBatch: ImageInfo[] | null;
    viewMode: 'grid' | number;
    onViewChange: (view: 'grid' | number) => void;
    altText?: string;
    isLoading: boolean;
    onSendToEdit: (filename: string) => void;
    currentMode: 'generate' | 'edit';
    baseImagePreviewUrl: string | null;
    streamingPreviewImages?: Map<number, string>;
};

const getGridColsClass = (count: number): string => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
};

export function ImageOutput({
    imageBatch,
    viewMode,
    onViewChange,
    altText = '生成的图片输出',
    isLoading,
    onSendToEdit,
    currentMode,
    baseImagePreviewUrl,
    streamingPreviewImages
}: ImageOutputProps) {
    const handleSendClick = () => {
        if (typeof viewMode === 'number' && imageBatch?.[viewMode]) {
            onSendToEdit(imageBatch[viewMode].filename);
        }
    };

    const showCarousel = imageBatch && imageBatch.length > 1;
    const isSingleImageView = typeof viewMode === 'number';
    const canSendToEdit = !isLoading && isSingleImageView && imageBatch && imageBatch[viewMode];

    return (
        <div className='flex h-full min-h-[320px] w-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl'>
            <div className='mb-3 flex items-center justify-between gap-3 px-1'>
                <div>
                    <p className='text-sm font-medium'>输出预览</p>
                    <p className='text-xs text-muted-foreground'>{isLoading ? '正在处理图像' : imageBatch?.length ? `${imageBatch.length} 张图片` : '等待生成结果'}</p>
                </div>
                <div className='rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground'>
                    {currentMode === 'edit' ? '编辑模式' : '生成模式'}
                </div>
            </div>

            <div className='relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-background/45'>
                <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_40%)]' />
                {isLoading ? (
                    streamingPreviewImages && streamingPreviewImages.size > 0 ? (
                        <div className='relative flex h-full w-full items-center justify-center p-4'>
                            {(() => {
                                const entries = Array.from(streamingPreviewImages.entries());
                                const latestEntry = entries[entries.length - 1];
                                if (!latestEntry) return null;
                                const [, dataUrl] = latestEntry;
                                return (
                                    <img
                                        src={dataUrl}
                                        alt='流式预览'
                                        className='max-h-full max-w-full rounded-2xl object-contain shadow-2xl shadow-black/30'
                                    />
                                );
                            })()}
                            <div className='absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/85 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur'>
                                <Loader2 className='h-4 w-4 animate-spin' />
                                <span>流式预览生成中</span>
                            </div>
                        </div>
                    ) : currentMode === 'edit' && baseImagePreviewUrl ? (
                        <div className='relative flex h-full w-full items-center justify-center'>
                            <img
                                src={baseImagePreviewUrl}
                                alt='编辑底图'
                                className='h-full w-full object-contain blur-md filter'
                            />
                            <div className='absolute inset-0 flex flex-col items-center justify-center bg-background/70 text-foreground backdrop-blur-sm'>
                                <Loader2 className='mb-3 h-9 w-9 animate-spin' />
                                <p className='font-medium'>正在编辑图像</p>
                                <p className='mt-1 text-xs text-muted-foreground'>保留原图结构并应用新的提示词</p>
                            </div>
                        </div>
                    ) : (
                        <div className='flex flex-col items-center justify-center text-muted-foreground'>
                            <Loader2 className='mb-3 h-9 w-9 animate-spin' />
                            <p className='font-medium text-foreground'>正在生成图像</p>
                            <p className='mt-1 text-xs'>结果会自动写入历史记录</p>
                        </div>
                    )
                ) : imageBatch && imageBatch.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className={`grid ${getGridColsClass(imageBatch.length)} h-full max-h-full w-full gap-2 p-3`}>
                            {imageBatch.map((img, index) => (
                                <button
                                    type='button'
                                    key={img.filename}
                                    onClick={() => onViewChange(index)}
                                    className='relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted/20 transition hover:-translate-y-0.5 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring'>
                                    <img
                                        src={img.path}
                                        alt={`生成图片 ${index + 1}`}
                                        className='h-full w-full object-contain'
                                    />
                                </button>
                            ))}
                        </div>
                    ) : imageBatch[viewMode] ? (
                        <img
                            src={imageBatch[viewMode].path}
                            alt={altText}
                            className='max-h-full max-w-full object-contain p-3'
                        />
                    ) : (
                        <div className='text-center text-muted-foreground'>
                            <p>图像显示时出错。</p>
                        </div>
                    )
                ) : (
                    <div className='flex max-w-sm flex-col items-center justify-center text-center text-muted-foreground'>
                        <div className='mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/30'>
                            <ImageIcon className='h-6 w-6' />
                        </div>
                        <p className='font-medium text-foreground'>画布已准备好</p>
                        <p className='mt-2 text-sm'>提交提示词后，生成结果会出现在这里，并自动同步到下方历史记录。</p>
                    </div>
                )}
            </div>

            <div className='mt-4 flex h-10 w-full shrink-0 items-center justify-center gap-4'>
                {showCarousel && (
                    <div className='flex items-center gap-1.5 rounded-full border border-border bg-background/45 p-1'>
                        <Button
                            variant='ghost'
                            size='icon'
                            className={cn('h-8 w-8 rounded-full p-1', viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                            onClick={() => onViewChange('grid')}
                            aria-label='显示网格视图'>
                            <Grid className='h-4 w-4' />
                        </Button>
                        {imageBatch.map((img, index) => (
                            <Button
                                key={img.filename}
                                variant='ghost'
                                size='icon'
                                className={cn(
                                    'h-8 w-8 overflow-hidden rounded-full p-0.5',
                                    viewMode === index ? 'ring-2 ring-ring ring-offset-1 ring-offset-background' : 'opacity-65 hover:opacity-100'
                                )}
                                onClick={() => onViewChange(index)}
                                aria-label={`选择图像 ${index + 1}`}>
                                <img
                                    src={img.path}
                                    alt={`缩略图 ${index + 1}`}
                                    className='h-full w-full rounded-full object-cover'
                                />
                            </Button>
                        ))}
                    </div>
                )}

                <Button
                    variant='outline'
                    size='sm'
                    onClick={handleSendClick}
                    disabled={!canSendToEdit}
                    className={cn('shrink-0 rounded-full disabled:pointer-events-none disabled:opacity-50', showCarousel && viewMode === 'grid' ? 'invisible' : 'visible')}>
                    <Send className='mr-2 h-4 w-4' />
                    发送到编辑
                </Button>
            </div>
        </div>
    );
}
