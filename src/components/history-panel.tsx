 'use client';

import type { HistoryMetadata } from '@/app/page';
import { getModelRates, type GptImageModel } from '@/lib/cost-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Check, Copy, DollarSign, Layers, Pencil, Sparkles as SparklesIcon, Trash2 } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type HistoryPanelProps = {
    history: HistoryMetadata[];
    onSelectImage: (item: HistoryMetadata) => void;
    onClearHistory: () => void;
    getImageSrc: (filename: string) => string | undefined;
    onDeleteItemRequest: (item: HistoryMetadata) => void;
    itemPendingDeleteConfirmation: HistoryMetadata | null;
    onConfirmDeletion: () => void;
    onCancelDeletion: () => void;
    deletePreferenceDialogValue: boolean;
    onDeletePreferenceDialogChange: (isChecked: boolean) => void;
};

type HistorySession = {
    id: string;
    items: HistoryMetadata[];
    startTimestamp: number;
    endTimestamp: number;
    totalCost: number;
    totalImages: number;
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

const formatHistoryTime = (timestamp: number): string => {
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date(timestamp));
};

const calculateCost = (value: number, rate: number): string => {
    const cost = value * rate;
    return Number.isNaN(cost) ? 'N/A' : cost.toFixed(4);
};

const groupHistoryBySession = (items: HistoryMetadata[]): HistorySession[] => {
    const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
    const sessions: HistorySession[] = [];

    for (const item of sorted) {
        const cost = item.costDetails?.estimated_cost_usd ?? 0;
        const imageCount = item.images?.length ?? 0;
        const itemFilenames = new Set(item.images?.map((img) => img.filename) ?? []);

        if (item.mode === 'generate') {
            sessions.push({
                id: `${item.timestamp}`,
                items: [item],
                startTimestamp: item.timestamp,
                endTimestamp: item.timestamp,
                totalCost: cost,
                totalImages: imageCount
            });
            continue;
        }

        let matchedSession: HistorySession | null = null;
        for (let i = sessions.length - 1; i >= 0; i--) {
            const sessionFileNames = new Set(
                sessions[i].items.flatMap((si) => si.images?.map((img) => img.filename) ?? [])
            );
            for (const fn of itemFilenames) {
                if (sessionFileNames.has(fn)) {
                    matchedSession = sessions[i];
                    break;
                }
            }
            if (matchedSession) break;
        }

        if (matchedSession) {
            matchedSession.items.push(item);
            matchedSession.endTimestamp = item.timestamp;
            matchedSession.totalCost += cost;
            matchedSession.totalImages += imageCount;
        } else {
            sessions.push({
                id: `${item.timestamp}`,
                items: [item],
                startTimestamp: item.timestamp,
                endTimestamp: item.timestamp,
                totalCost: cost,
                totalImages: imageCount
            });
        }
    }

    return sessions.sort((a, b) => b.endTimestamp - a.endTimestamp);
};

function HistoryPanelImpl({
    history,
    onSelectImage,
    onClearHistory,
    getImageSrc,
    onDeleteItemRequest,
    itemPendingDeleteConfirmation,
    onConfirmDeletion,
    onCancelDeletion,
    deletePreferenceDialogValue,
    onDeletePreferenceDialogChange
}: HistoryPanelProps) {
    const [openPromptDialogTimestamp, setOpenPromptDialogTimestamp] = React.useState<number | null>(null);
    const [openCostDialogTimestamp, setOpenCostDialogTimestamp] = React.useState<number | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [copiedTimestamp, setCopiedTimestamp] = React.useState<number | null>(null);

    const { totalCost, totalImages } = React.useMemo(() => {
        let cost = 0;
        let images = 0;
        for (const item of history) {
            if (item.costDetails) cost += item.costDetails.estimated_cost_usd;
            images += item.images?.length ?? 0;
        }
        return {
            totalCost: Math.round(cost * 10000) / 10000,
            totalImages: images
        };
    }, [history]);

    const historySessions = React.useMemo(() => groupHistoryBySession(history), [history]);
    const averageCost = totalImages > 0 ? totalCost / totalImages : 0;

    const handleCopy = async (text: string | null | undefined, timestamp: number) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedTimestamp(timestamp);
            setTimeout(() => setCopiedTimestamp(null), 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <Card className='flex w-full flex-col overflow-visible rounded-2xl border border-white/6 bg-black/55 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/6 px-4 py-3'>
                <div className='flex items-center gap-2'>
                    <CardTitle className='text-lg font-medium text-white'>历史记录</CardTitle>
                    {history.length > 0 && (
                        <div className='ml-1 hidden items-center gap-1.5 md:flex'>
                            <span className='rounded-md border border-white/8 bg-white/[0.02] px-1.5 py-0.5 text-[11px] text-white/35'>
                                {history.length} 记录
                            </span>
                            {historySessions.length < history.length && (
                                <span className='rounded-md border border-white/8 bg-white/[0.02] px-1.5 py-0.5 text-[11px] text-white/35'>
                                    {historySessions.length} 链
                                </span>
                            )}
                        </div>
                    )}
                    {totalCost > 0 && (
                        <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                            <DialogTrigger asChild>
                                <button
                                    className='mt-0.5 flex items-center gap-1 rounded-full border border-green-400/20 bg-green-600/75 px-2 py-0.5 text-[12px] text-white transition-all hover:bg-green-500/90 hover:shadow-[0_0_16px_rgba(34,197,94,0.22)]'
                                    aria-label='显示总费用简析'>
                                    总费用: ${totalCost.toFixed(4)}
                                </button>
                            </DialogTrigger>
                            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                <DialogHeader>
                                    <DialogTitle className='text-white'>总费用简析</DialogTitle>
                                    <DialogDescription className='sr-only'>所有生成图像在历史记录中的估计总费用详情。</DialogDescription>
                                </DialogHeader>
                                <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                                    <p className='font-medium'>gpt-image-2:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>文本输入: $5 / 1M 令牌</li>
                                        <li>图像输入: $8 / 1M 令牌</li>
                                        <li>图像输出: $30 / 1M 令牌</li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1.5:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>文本输入: $5 / 1M 令牌</li>
                                        <li>图像输入: $8 / 1M 令牌</li>
                                        <li>图像输出: $32 / 1M 令牌</li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>文本输入: $5 / 1M 令牌</li>
                                        <li>图像输入: $10 / 1M 令牌</li>
                                        <li>图像输出: $40 / 1M 令牌</li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1-mini:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>文本输入: $2 / 1M 令牌</li>
                                        <li>图像输入: $2.50 / 1M 令牌</li>
                                        <li>图像输出: $8 / 1M 令牌</li>
                                    </ul>
                                </div>
                                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                    <div className='flex justify-between'>
                                        <span>历史图像总数:</span>
                                        <span>{totalImages.toLocaleString()}</span>
                                    </div>
                                    <div className='flex justify-between'>
                                        <span>平均单图成本:</span>
                                        <span>${averageCost.toFixed(4)}</span>
                                    </div>
                                    <hr className='my-2 border-neutral-700' />
                                    <div className='flex justify-between font-medium text-white'>
                                        <span>估计总费用:</span>
                                        <span>${totalCost.toFixed(4)}</span>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type='button' variant='secondary' size='sm' className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                            关闭
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                {history.length > 0 && (
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClearHistory}
                        className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                        清空
                    </Button>
                )}
            </CardHeader>

            <CardContent className='overflow-x-auto pb-4 pt-6'>
                {history.length === 0 ? (
                    <div className='flex h-full min-h-[100px] items-center justify-center text-white/40'>
                        <p>生成的图像将出现在此处。</p>
                    </div>
                ) : (
                    <div className='pb-4'>
                        <div className='flex min-w-max gap-5'>
                            {historySessions.map((session) => {
                                const genCount = session.items.filter((i) => i.mode === 'generate').length;
                                const editCount = session.items.filter((i) => i.mode === 'edit').length;
                                const sessionSize = session.items.length;

                                return (
                                    <div
                                        key={session.id}
                                        className='group/session relative flex shrink-0 flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-2.5 transition-colors duration-300 hover:border-white/[0.12] hover:bg-white/[0.025]'>
                                        <div className='flex items-center justify-between gap-2 text-[10px] text-neutral-400'>
                                            <div className='flex items-center gap-1.5'>
                                                <span className={genCount > 0 ? 'text-blue-400' : 'text-orange-400'}>
                                                    {genCount > 0 ? '✦ 创建' : '✎ 编辑'}
                                                </span>
                                                {editCount > 0 && <span className='text-orange-400/70'>+{editCount}</span>}
                                                {sessionSize > 1 && <span className='text-white/30'>· {sessionSize} 步</span>}
                                            </div>
                                            <div className='text-white/30'>
                                                {session.totalImages}张 · ${session.totalCost.toFixed(4)}
                                            </div>
                                        </div>

                                        <div className='flex gap-2'>
                                            {session.items.map((item) => {
                                                const firstImage = item.images?.[0];
                                                const imageCount = item.images?.length ?? 0;
                                                const isMultiImage = imageCount > 1;
                                                const itemKey = item.timestamp;
                                                const storageMode = item.storageModeUsed || 'fs';
                                                const thumbUrl = firstImage
                                                    ? storageMode === 'indexeddb'
                                                        ? getImageSrc(firstImage.filename)
                                                        : `/api/image/${firstImage.filename}`
                                                    : undefined;

                                                return (
                                                    <div
                                                        key={itemKey}
                                                        className='group relative w-20 shrink-0 transition-all duration-200 hover:z-40 hover:scale-[1.14] sm:w-24 md:w-28'>
                                                        <button
                                                            onClick={() => onSelectImage(item)}
                                                            className={cn(
                                                                'relative block aspect-square w-full rounded-xl border shadow-sm transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl group-hover:shadow-white/10 focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black focus:outline-none',
                                                                'bg-white/[0.03]',
                                                                genCount > 0
                                                                    ? 'border-blue-500/15 hover:border-blue-400/40'
                                                                    : 'border-orange-500/15 hover:border-orange-400/40'
                                                            )}
                                                            aria-label={`查看 ${new Date(item.timestamp).toLocaleString()} 的图片`}>
                                                            {thumbUrl ? (
                                                                <Image
                                                                    src={thumbUrl}
                                                                    alt={`预览 ${new Date(item.timestamp).toLocaleString()}`}
                                                                    width={150}
                                                                    height={150}
                                                                    className='h-full w-full rounded-xl object-cover'
                                                                    unoptimized
                                                                    loading='lazy'
                                                                />
                                                            ) : (
                                                                <div className='flex h-full w-full items-center justify-center rounded-xl bg-neutral-800/60 text-neutral-500'>
                                                                    ?
                                                                </div>
                                                            )}
                                                            <div
                                                                className={cn(
                                                                    'pointer-events-none absolute left-1 top-1 z-10 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-white font-medium leading-none shadow-sm backdrop-blur-sm',
                                                                    item.mode === 'edit' ? 'bg-orange-500/70' : 'bg-blue-500/70'
                                                                )}>
                                                                {item.mode === 'edit' ? <Pencil size={10} /> : <SparklesIcon size={10} />}
                                                                {item.mode === 'edit' ? '编辑' : '创建'}
                                                            </div>
                                                            {isMultiImage && (
                                                                <div className='pointer-events-none absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white leading-none backdrop-blur-sm'>
                                                                    <Layers size={10} />
                                                                    {imageCount}
                                                                </div>
                                                            )}
                                                            <div className='pointer-events-none absolute bottom-1 right-1 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70 leading-none backdrop-blur-sm'>
                                                                {formatDuration(item.durationMs)}
                                                            </div>
                                                            <div className='pointer-events-none absolute bottom-1 left-1 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white/60 leading-none backdrop-blur-sm'>
                                                                {formatHistoryTime(item.timestamp)}
                                                            </div>
                                                            <div className='pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100' />
                                                        </button>

                                                        <div className='pointer-events-none absolute inset-x-0 bottom-0 z-30 flex translate-y-1 flex-col gap-1 p-1.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100'>
                                                            <div className='overflow-hidden rounded-lg bg-black/80 px-2 py-1 text-[10px] text-white/80 leading-tight truncate ring-1 ring-white/10 backdrop-blur-sm'>
                                                                {item.prompt || '未记录提示词'}
                                                            </div>

                                                            <div className='flex items-center justify-center gap-1.5'>
                                                                <Dialog open={openPromptDialogTimestamp === itemKey} onOpenChange={(o) => !o && setOpenPromptDialogTimestamp(null)}>
                                                                    <DialogTrigger asChild>
                                                                        <button
                                                                            className='pointer-events-auto flex h-6 w-6 items-center justify-center rounded-lg bg-white/25 text-white transition-all duration-200 hover:bg-white/40 hover:text-white hover:scale-110 leading-none ring-1 ring-white/20'
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setOpenPromptDialogTimestamp(itemKey);
                                                                            }}
                                                                            aria-label='查看提示词'>
                                                                            P
                                                                        </button>
                                                                    </DialogTrigger>
                                                                    <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[625px]'>
                                                                        <DialogHeader>
                                                                            <DialogTitle className='text-white'>提示词</DialogTitle>
                                                                            <DialogDescription className='sr-only'>用于生成这批图像的完整提示词。</DialogDescription>
                                                                        </DialogHeader>
                                                                        <div className='max-h-[400px] overflow-y-auto rounded-md border border-neutral-600 bg-neutral-800 p-3 py-4 text-sm text-neutral-300'>
                                                                            {item.prompt || '未记录提示词。'}
                                                                        </div>
                                                                        <DialogFooter>
                                                                            <Button
                                                                                variant='outline'
                                                                                size='sm'
                                                                                onClick={() => handleCopy(item.prompt, itemKey)}
                                                                                className='border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white'>
                                                                                {copiedTimestamp === itemKey ? <Check className='mr-2 h-4 w-4 text-green-400' /> : <Copy className='mr-2 h-4 w-4' />}
                                                                                {copiedTimestamp === itemKey ? '已复制!' : '复制'}
                                                                            </Button>
                                                                            <DialogClose asChild>
                                                                                <Button type='button' variant='secondary' size='sm' className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                                                                    关闭
                                                                                </Button>
                                                                            </DialogClose>
                                                                        </DialogFooter>
                                                                    </DialogContent>
                                                                </Dialog>

                                                                {item.costDetails && (
                                                                    <Dialog open={openCostDialogTimestamp === itemKey} onOpenChange={(o) => !o && setOpenCostDialogTimestamp(null)}>
                                                                        <DialogTrigger asChild>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setOpenCostDialogTimestamp(itemKey);
                                                                                }}
                                                                                className='pointer-events-auto flex h-6 items-center gap-1 rounded-lg bg-green-600/80 px-1.5 text-[10px] text-white font-medium transition-all duration-200 hover:bg-green-500 hover:scale-110 leading-none'
                                                                                aria-label='查看费用明细'>
                                                                                <DollarSign size={10} />
                                                                                {item.costDetails.estimated_cost_usd.toFixed(4)}
                                                                            </button>
                                                                        </DialogTrigger>
                                                                        <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                                                            <DialogHeader>
                                                                                <DialogTitle className='text-white'>费用明细</DialogTitle>
                                                                                <DialogDescription className='sr-only'>此次图像生成的估计费用明细。</DialogDescription>
                                                                            </DialogHeader>
                                                                            {(() => {
                                                                                const m: GptImageModel = (item.model || 'gpt-image-1') as GptImageModel;
                                                                                const r = getModelRates(m);
                                                                                return (
                                                                                    <>
                                                                                        <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                                                                                            <p>{m} 定价:</p>
                                                                                            <ul className='list-disc pl-4'>
                                                                                                <li>文本输入: ${r.textInputPerMillion} / 100万 tokens</li>
                                                                                                <li>图像输入: ${r.imageInputPerMillion} / 100万 tokens</li>
                                                                                                <li>图像输出: ${r.imageOutputPerMillion} / 100万 tokens</li>
                                                                                            </ul>
                                                                                        </div>
                                                                                        <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                                                                            <div className='flex justify-between'><span>文本输入令牌:</span><span>{item.costDetails.text_input_tokens.toLocaleString()} (~${calculateCost(item.costDetails.text_input_tokens, r.textInputPerToken)})</span></div>
                                                                                            {item.costDetails.image_input_tokens > 0 && <div className='flex justify-between'><span>图像输入令牌:</span><span>{item.costDetails.image_input_tokens.toLocaleString()} (~${calculateCost(item.costDetails.image_input_tokens, r.imageInputPerToken)})</span></div>}
                                                                                            <div className='flex justify-between'><span>图像输出令牌:</span><span>{item.costDetails.image_output_tokens.toLocaleString()} (~${calculateCost(item.costDetails.image_output_tokens, r.imageOutputPerToken)})</span></div>
                                                                                            <hr className='my-2 border-neutral-700' />
                                                                                            <div className='flex justify-between font-medium text-white'><span>估计总费用:</span><span>${item.costDetails.estimated_cost_usd.toFixed(4)}</span></div>
                                                                                        </div>
                                                                                    </>
                                                                                );
                                                                            })()}
                                                                            <DialogFooter>
                                                                                <DialogClose asChild>
                                                                                    <Button type='button' variant='secondary' size='sm' className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                                                                        关闭
                                                                                    </Button>
                                                                                </DialogClose>
                                                                            </DialogFooter>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                )}

                                                                <Dialog open={itemPendingDeleteConfirmation?.timestamp === item.timestamp} onOpenChange={(o) => { if (!o) onCancelDeletion(); }}>
                                                                    <DialogTrigger asChild>
                                                                        <button
                                                                            className='pointer-events-auto flex h-6 w-6 items-center justify-center rounded-lg bg-red-600/50 text-white font-medium transition-all duration-200 hover:bg-red-500 hover:text-white hover:scale-110 leading-none'
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onDeleteItemRequest(item);
                                                                            }}
                                                                            aria-label='删除历史条目'>
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </DialogTrigger>
                                                                    <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-md'>
                                                                        <DialogHeader>
                                                                            <DialogTitle className='text-white'>确认删除</DialogTitle>
                                                                            <DialogDescription className='pt-2 text-neutral-300'>
                                                                                确定要删除此历史记录？将移除 {item.images.length} 张图片。此操作不可撤销。
                                                                            </DialogDescription>
                                                                        </DialogHeader>
                                                                        <div className='flex items-center space-x-2 py-2'>
                                                                            <Checkbox
                                                                                id={`dont-ask-${item.timestamp}`}
                                                                                checked={deletePreferenceDialogValue}
                                                                                onCheckedChange={(c) => onDeletePreferenceDialogChange(!!c)}
                                                                                className='border-neutral-400 bg-white data-[state=checked]:border-neutral-700 data-[state=checked]:bg-white data-[state=checked]:text-black dark:border-neutral-500 dark:!bg-white'
                                                                            />
                                                                            <label htmlFor={`dont-ask-${item.timestamp}`} className='text-xs leading-none font-medium text-neutral-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                                                                                不再询问
                                                                            </label>
                                                                        </div>
                                                                        <DialogFooter className='gap-2 sm:justify-end'>
                                                                            <Button type='button' variant='outline' size='sm' onClick={onCancelDeletion} className='border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white'>
                                                                                取消
                                                                            </Button>
                                                                            <Button type='button' variant='destructive' size='sm' onClick={onConfirmDeletion} className='bg-red-600 text-white hover:bg-red-500'>
                                                                                删除
                                                                            </Button>
                                                                        </DialogFooter>
                                                                    </DialogContent>
                                                                </Dialog>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export const HistoryPanel = React.memo(HistoryPanelImpl);
