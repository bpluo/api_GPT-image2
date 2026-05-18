'use client';

/* eslint-disable @next/next/no-img-element */

import type { HistoryMetadata } from '@/app/page';
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
import { getModelRates, type GptImageModel } from '@/lib/cost-utils';
import { cn } from '@/lib/utils';
import { Check, Clock3, Copy, DollarSign, ImageOff, Layers, Pencil, Sparkles, Trash2 } from 'lucide-react';
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

const getItemId = (item: HistoryMetadata) => item.id || `${item.timestamp}`;

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

const makeSession = (id: string, item: HistoryMetadata): HistorySession => ({
    id,
    items: [item],
    startTimestamp: item.timestamp,
    endTimestamp: item.timestamp,
    totalCost: item.costDetails?.estimated_cost_usd ?? 0,
    totalImages: item.images?.length ?? 0
});

const appendToSession = (session: HistorySession, item: HistoryMetadata) => {
    session.items.push(item);
    session.startTimestamp = Math.min(session.startTimestamp, item.timestamp);
    session.endTimestamp = Math.max(session.endTimestamp, item.timestamp);
    session.totalCost += item.costDetails?.estimated_cost_usd ?? 0;
    session.totalImages += item.images?.length ?? 0;
};

const groupHistoryBySession = (items: HistoryMetadata[]): HistorySession[] => {
    const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
    const sessionMap = new Map<string, HistorySession>();
    const itemToSession = new Map<string, string>();
    const fallbackSessions: HistorySession[] = [];

    for (const item of sorted) {
        const itemId = getItemId(item);
        const explicitSessionId = item.sessionId || (item.parentId ? itemToSession.get(item.parentId) : undefined);

        if (explicitSessionId) {
            const existingSession = sessionMap.get(explicitSessionId);
            if (existingSession) {
                appendToSession(existingSession, item);
            } else {
                sessionMap.set(explicitSessionId, makeSession(explicitSessionId, item));
            }
            itemToSession.set(itemId, explicitSessionId);
            continue;
        }

        if (item.mode === 'generate') {
            const id = item.sessionId || itemId;
            sessionMap.set(id, makeSession(id, item));
            itemToSession.set(itemId, id);
            continue;
        }

        const sourceNames = new Set([...(item.sourceImageFilenames ?? []), ...(item.images?.map((img) => img.filename) ?? [])]);
        const matchedSession = [...sessionMap.values(), ...fallbackSessions]
            .reverse()
            .find((session) =>
                session.items.some((sessionItem) =>
                    sessionItem.images?.some((img) => sourceNames.has(img.filename)) ||
                    sessionItem.sourceImageFilenames?.some((filename) => sourceNames.has(filename))
                )
            );

        if (matchedSession) {
            appendToSession(matchedSession, item);
            itemToSession.set(itemId, matchedSession.id);
        } else {
            const fallbackSession = makeSession(itemId, item);
            fallbackSessions.push(fallbackSession);
            itemToSession.set(itemId, itemId);
        }
    }

    return [...sessionMap.values(), ...fallbackSessions]
        .map((session) => ({ ...session, items: [...session.items].sort((a, b) => a.timestamp - b.timestamp) }))
        .sort((a, b) => b.endTimestamp - a.endTimestamp);
};

const getThumbUrl = (item: HistoryMetadata, getImageSrc: (filename: string) => string | undefined) => {
    const filename = item.coverImageFilename || item.images?.[0]?.filename;
    if (!filename) return undefined;
    return (item.storageModeUsed || 'fs') === 'indexeddb' ? getImageSrc(filename) : `/api/image/${filename}`;
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
    const [openPromptDialogId, setOpenPromptDialogId] = React.useState<string | null>(null);
    const [openCostDialogId, setOpenCostDialogId] = React.useState<string | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [copiedId, setCopiedId] = React.useState<string | null>(null);

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

    const handleCopy = async (text: string | null | undefined, id: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <Card className='flex w-full flex-col overflow-visible rounded-3xl border-border/70 bg-card/70 shadow-2xl shadow-black/20 backdrop-blur-xl'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-border/70 px-5 py-4'>
                <div className='flex min-w-0 items-center gap-3'>
                    <div className='flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary'>
                        <Clock3 className='h-4 w-4' />
                    </div>
                    <div>
                        <CardTitle className='text-lg font-semibold'>历史记录</CardTitle>
                        <div className='mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground'>
                            <span>{history.length} 条记录</span>
                            <span>·</span>
                            <span>{historySessions.length} 条链路</span>
                            {totalCost > 0 && (
                                <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                                    <DialogTrigger asChild>
                                        <button className='rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300 transition hover:bg-emerald-500/20'>
                                            总费用 ${totalCost.toFixed(4)}
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className='sm:max-w-[450px]'>
                                        <DialogHeader>
                                            <DialogTitle>总费用简析</DialogTitle>
                                            <DialogDescription>历史记录中的估算费用，仅用于参考。</DialogDescription>
                                        </DialogHeader>
                                        <div className='space-y-2 text-sm text-muted-foreground'>
                                            <div className='flex justify-between'><span>历史图像总数</span><span>{totalImages.toLocaleString()}</span></div>
                                            <div className='flex justify-between'><span>平均单图成本</span><span>${averageCost.toFixed(4)}</span></div>
                                            <div className='flex justify-between font-medium text-foreground'><span>估计总费用</span><span>${totalCost.toFixed(4)}</span></div>
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button type='button' variant='secondary' size='sm'>关闭</Button>
                                            </DialogClose>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </div>
                {history.length > 0 && (
                    <Button variant='ghost' size='sm' onClick={onClearHistory} className='rounded-full text-muted-foreground'>
                        清空
                    </Button>
                )}
            </CardHeader>

            <CardContent className='overflow-x-auto p-5'>
                {history.length === 0 ? (
                    <div className='flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/30 text-center text-muted-foreground'>
                        <Sparkles className='mb-3 h-7 w-7 opacity-60' />
                        <p className='font-medium text-foreground'>还没有历史记录</p>
                        <p className='mt-1 text-sm'>生成或编辑完成后，会在这里形成可回看的创作链路。</p>
                    </div>
                ) : (
                    <div className='flex min-w-max gap-4 pb-2'>
                        {historySessions.map((session) => {
                            const genCount = session.items.filter((i) => i.mode === 'generate').length;
                            const editCount = session.items.filter((i) => i.mode === 'edit').length;

                            return (
                                <div
                                    key={session.id}
                                    className='relative flex shrink-0 flex-col gap-3 rounded-3xl border border-border/70 bg-background/35 p-3 shadow-lg shadow-black/10'>
                                    <div className='flex items-center justify-between gap-4 px-1 text-[11px] text-muted-foreground'>
                                        <div className='flex items-center gap-1.5'>
                                            <span className='font-medium text-foreground'>{genCount > 0 ? '创建链路' : '编辑链路'}</span>
                                            {editCount > 0 && <span className='text-amber-400'>+{editCount} 编辑</span>}
                                            {session.items.length > 1 && <span>· {session.items.length} 步</span>}
                                        </div>
                                        <div>{session.totalImages} 张 · ${session.totalCost.toFixed(4)}</div>
                                    </div>

                                    <div className='flex gap-2.5'>
                                        {session.items.map((item, index) => {
                                            const itemId = getItemId(item);
                                            const imageCount = item.images?.length ?? 0;
                                            const isMultiImage = imageCount > 1;
                                            const thumbUrl = getThumbUrl(item, getImageSrc);
                                            const isEdit = item.mode === 'edit';

                                            return (
                                                <div key={itemId} className='group relative w-28 shrink-0'>
                                                    {index > 0 && (
                                                        <div className='absolute -left-3 top-1/2 h-px w-3 bg-border' aria-hidden='true' />
                                                    )}
                                                    <button
                                                        onClick={() => onSelectImage(item)}
                                                        className={cn(
                                                            'relative block aspect-square w-full overflow-hidden rounded-2xl border bg-muted/30 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                                                            isEdit ? 'border-amber-400/25' : 'border-sky-400/25'
                                                        )}
                                                        aria-label={`查看 ${new Date(item.timestamp).toLocaleString()} 的图片`}>
                                                        {thumbUrl ? (
                                                            <img
                                                                src={thumbUrl}
                                                                alt={`预览 ${new Date(item.timestamp).toLocaleString()}`}
                                                                className='h-full w-full object-cover transition duration-500 group-hover:scale-105'
                                                                loading='lazy'
                                                            />
                                                        ) : (
                                                            <div className='flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground'>
                                                                <ImageOff className='h-5 w-5' />
                                                                <span className='text-[10px]'>缺图</span>
                                                            </div>
                                                        )}
                                                        <div className='absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent' />
                                                        <div
                                                            className={cn(
                                                                'absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-white shadow-sm backdrop-blur',
                                                                isEdit ? 'bg-amber-500/80' : 'bg-sky-500/80'
                                                            )}>
                                                            {isEdit ? <Pencil size={10} /> : <Sparkles size={10} />}
                                                            {isEdit ? '编辑' : '创建'}
                                                        </div>
                                                        {isMultiImage && (
                                                            <div className='absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur'>
                                                                <Layers size={10} />
                                                                {imageCount}
                                                            </div>
                                                        )}
                                                        <div className='absolute inset-x-2 bottom-2 space-y-1 text-left'>
                                                            <p className='truncate text-[11px] font-medium text-white'>{item.prompt || '未记录提示词'}</p>
                                                            <div className='flex items-center justify-between text-[10px] text-white/70'>
                                                                <span>{formatHistoryTime(item.timestamp)}</span>
                                                                <span>{formatDuration(item.durationMs)}</span>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    <div className='mt-2 flex items-center justify-center gap-1.5 opacity-80 transition group-hover:opacity-100'>
                                                        <Dialog open={openPromptDialogId === itemId} onOpenChange={(o) => !o && setOpenPromptDialogId(null)}>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    type='button'
                                                                    variant='secondary'
                                                                    size='sm'
                                                                    className='h-7 rounded-full px-2 text-[11px]'
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenPromptDialogId(itemId);
                                                                    }}>
                                                                    提示词
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className='sm:max-w-[625px]'>
                                                                <DialogHeader>
                                                                    <DialogTitle>提示词</DialogTitle>
                                                                    <DialogDescription>用于生成这批图像的完整提示词。</DialogDescription>
                                                                </DialogHeader>
                                                                <div className='max-h-[400px] overflow-y-auto rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6'>
                                                                    {item.prompt || '未记录提示词。'}
                                                                </div>
                                                                <DialogFooter>
                                                                    <Button variant='outline' size='sm' onClick={() => handleCopy(item.prompt, itemId)}>
                                                                        {copiedId === itemId ? <Check className='mr-2 h-4 w-4 text-emerald-500' /> : <Copy className='mr-2 h-4 w-4' />}
                                                                        {copiedId === itemId ? '已复制' : '复制'}
                                                                    </Button>
                                                                    <DialogClose asChild>
                                                                        <Button type='button' variant='secondary' size='sm'>关闭</Button>
                                                                    </DialogClose>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>

                                                        {item.costDetails && (
                                                            <Dialog open={openCostDialogId === itemId} onOpenChange={(o) => !o && setOpenCostDialogId(null)}>
                                                                <DialogTrigger asChild>
                                                                    <Button
                                                                        type='button'
                                                                        variant='secondary'
                                                                        size='sm'
                                                                        className='h-7 rounded-full px-2 text-[11px] text-emerald-300'
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenCostDialogId(itemId);
                                                                        }}>
                                                                        <DollarSign size={12} />
                                                                        {item.costDetails.estimated_cost_usd.toFixed(4)}
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className='sm:max-w-[450px]'>
                                                                    <DialogHeader>
                                                                        <DialogTitle>费用明细</DialogTitle>
                                                                        <DialogDescription>此次图像生成的估计费用明细。</DialogDescription>
                                                                    </DialogHeader>
                                                                    {(() => {
                                                                        const m: GptImageModel = (item.model || 'gpt-image-1') as GptImageModel;
                                                                        const r = getModelRates(m);
                                                                        return (
                                                                            <div className='space-y-4 text-sm'>
                                                                                <div className='rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground'>
                                                                                    <p className='font-medium text-foreground'>{m} 定价</p>
                                                                                    <ul className='mt-2 list-disc space-y-1 pl-4'>
                                                                                        <li>文本输入: ${r.textInputPerMillion} / 100万 tokens</li>
                                                                                        <li>图像输入: ${r.imageInputPerMillion} / 100万 tokens</li>
                                                                                        <li>图像输出: ${r.imageOutputPerMillion} / 100万 tokens</li>
                                                                                    </ul>
                                                                                </div>
                                                                                <div className='space-y-2'>
                                                                                    <div className='flex justify-between'><span>文本输入令牌</span><span>{item.costDetails.text_input_tokens.toLocaleString()} (~${calculateCost(item.costDetails.text_input_tokens, r.textInputPerToken)})</span></div>
                                                                                    {item.costDetails.image_input_tokens > 0 && <div className='flex justify-between'><span>图像输入令牌</span><span>{item.costDetails.image_input_tokens.toLocaleString()} (~${calculateCost(item.costDetails.image_input_tokens, r.imageInputPerToken)})</span></div>}
                                                                                    <div className='flex justify-between'><span>图像输出令牌</span><span>{item.costDetails.image_output_tokens.toLocaleString()} (~${calculateCost(item.costDetails.image_output_tokens, r.imageOutputPerToken)})</span></div>
                                                                                    <div className='flex justify-between border-t border-border pt-2 font-medium'><span>估计总费用</span><span>${item.costDetails.estimated_cost_usd.toFixed(4)}</span></div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    <DialogFooter>
                                                                        <DialogClose asChild>
                                                                            <Button type='button' variant='secondary' size='sm'>关闭</Button>
                                                                        </DialogClose>
                                                                    </DialogFooter>
                                                                </DialogContent>
                                                            </Dialog>
                                                        )}

                                                        <Dialog open={itemPendingDeleteConfirmation?.timestamp === item.timestamp} onOpenChange={(o) => { if (!o) onCancelDeletion(); }}>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    type='button'
                                                                    variant='ghost'
                                                                    size='icon'
                                                                    className='h-7 w-7 rounded-full text-muted-foreground hover:text-destructive'
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onDeleteItemRequest(item);
                                                                    }}
                                                                    aria-label='删除历史条目'>
                                                                    <Trash2 size={13} />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className='sm:max-w-md'>
                                                                <DialogHeader>
                                                                    <DialogTitle>确认删除</DialogTitle>
                                                                    <DialogDescription>
                                                                        确定要删除此历史记录？将移除 {item.images.length} 张图片。此操作不可撤销。
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <div className='flex items-center space-x-2 py-2'>
                                                                    <Checkbox
                                                                        id={`dont-ask-${itemId}`}
                                                                        checked={deletePreferenceDialogValue}
                                                                        onCheckedChange={(c) => onDeletePreferenceDialogChange(!!c)}
                                                                    />
                                                                    <label htmlFor={`dont-ask-${itemId}`} className='text-sm text-muted-foreground'>
                                                                        不再询问
                                                                    </label>
                                                                </div>
                                                                <DialogFooter className='gap-2 sm:justify-end'>
                                                                    <Button type='button' variant='outline' size='sm' onClick={onCancelDeletion}>取消</Button>
                                                                    <Button type='button' variant='destructive' size='sm' onClick={onConfirmDeletion}>删除</Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export const HistoryPanel = React.memo(HistoryPanelImpl);
