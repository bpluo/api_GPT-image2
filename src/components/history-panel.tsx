'use client';

import { StoredImage } from '@/components/stored-image';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { groupHistoryBySession, type HistoryMetadata } from '@/lib/history';
import { getRequestSize } from '@/lib/image-settings';
import { cn } from '@/lib/utils';
import { Check, Clock3, Copy, Download, FileText, RotateCcw, Search, Trash2, X } from 'lucide-react';
import * as React from 'react';

function formatTime(timestamp: number) {
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(timestamp);
}

export function HistoryPanel({
    history,
    selectedId,
    disabled,
    onSelect,
    onRestore,
    onDelete,
    onClear,
    confirmDeletion,
    onConfirmDeletionChange
}: {
    history: HistoryMetadata[];
    selectedId?: string;
    disabled: boolean;
    onSelect: (item: HistoryMetadata) => void;
    onRestore: (item: HistoryMetadata) => void;
    onDelete: (item: HistoryMetadata) => void;
    onClear: () => void;
    confirmDeletion: boolean;
    onConfirmDeletionChange: (enabled: boolean) => void;
}) {
    const [query, setQuery] = React.useState('');
    const [filter, setFilter] = React.useState<'all' | 'generate' | 'edit'>('all');
    const [grouped, setGrouped] = React.useState(false);
    const [limit, setLimit] = React.useState(24);
    const [detail, setDetail] = React.useState<HistoryMetadata | null>(null);
    const [copied, setCopied] = React.useState(false);
    const [copyError, setCopyError] = React.useState(false);
    const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(
        () => () => {
            if (copyTimer.current) clearTimeout(copyTimer.current);
        },
        []
    );
    React.useEffect(() => {
        setLimit(24);
    }, [query, filter]);
    const filtered = React.useMemo(() => {
        const search = query.trim().toLowerCase();
        return history.filter(
            (item) =>
                (filter === 'all' || item.mode === filter) &&
                (!search ||
                    [item.prompt, item.model, item.presetTitle, item.presetCategory, ...(item.presetTags || [])]
                        .join(' ')
                        .toLowerCase()
                        .includes(search))
        );
    }, [history, query, filter]);
    const visible = filtered.slice(0, limit);
    const groups = grouped ? groupHistoryBySession(visible) : [{ id: 'recent', items: visible, endTimestamp: 0 }];
    const totalImages = history.reduce((total, item) => total + item.images.length, 0);
    const knownCost = history.reduce((total, item) => total + (item.costDetails?.estimated_cost_usd || 0), 0);
    const exportHistory = () => {
        const url = URL.createObjectURL(
            new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), history }, null, 2)], {
                type: 'application/json'
            })
        );
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `image-workshop-history-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <section aria-label='历史记录' className='border-border bg-card min-w-0 rounded-2xl border'>
            <div className='border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5'>
                <div className='flex items-center gap-3'>
                    <Clock3 className='text-primary h-5 w-5' />
                    <div>
                        <h2 className='text-base font-semibold'>历史记录</h2>
                        <p className='text-muted-foreground mt-1 text-xs'>
                            {history.length} 次创作 · {totalImages} 张图片
                            {knownCost > 0 && ` · 已知费用估算 $${knownCost.toFixed(4)}`}
                        </p>
                    </div>
                </div>
                {history.length > 0 && (
                    <div className='flex gap-1'>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={exportHistory}
                            title='导出提示词、参数和历史信息，不包含图片文件'>
                            <Download className='h-4 w-4' />
                            导出记录
                        </Button>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            disabled={disabled}
                            onClick={onClear}
                            className='text-muted-foreground hover:text-destructive'>
                            清空历史
                        </Button>
                    </div>
                )}
            </div>
            {history.length === 0 ? (
                <div className='flex flex-col items-center gap-2 px-5 py-9 text-center'>
                    <Clock3 className='text-muted-foreground/60 mb-1 h-6 w-6' />
                    <p className='text-sm font-medium'>你的作品会留在这里</p>
                    <p className='text-muted-foreground text-xs leading-5'>
                        完成第一次创作后，可以查看图片、复用参数或继续编辑。
                    </p>
                </div>
            ) : (
                <>
                    <div className='flex flex-wrap items-center gap-3 p-4 sm:px-5'>
                        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                            <Checkbox
                                id='history-confirm-deletion'
                                checked={confirmDeletion}
                                disabled={disabled}
                                onCheckedChange={(value) => onConfirmDeletionChange(value === true)}
                            />
                            <label htmlFor='history-confirm-deletion'>删除前确认</label>
                        </div>
                        <div className='relative min-w-[160px] flex-1'>
                            <Search className='text-muted-foreground pointer-events-none absolute top-3 left-3 h-4 w-4' />
                            <Input
                                aria-label='搜索历史记录'
                                placeholder='搜索提示词、模板或模型'
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                className='h-10 pr-9 pl-9'
                            />
                            {query && (
                                <button
                                    type='button'
                                    aria-label='清除搜索'
                                    onClick={() => setQuery('')}
                                    className='text-muted-foreground absolute top-1 right-1 h-8 w-8 rounded p-2'>
                                    <X className='h-4 w-4' />
                                </button>
                            )}
                        </div>
                        <select
                            aria-label='筛选创作类型'
                            value={filter}
                            onChange={(event) => setFilter(event.target.value as typeof filter)}
                            className='border-border bg-background h-10 rounded-lg border px-3 text-sm'>
                            <option value='all'>全部类型</option>
                            <option value='generate'>生成图片</option>
                            <option value='edit'>编辑图片</option>
                        </select>
                        <Button
                            type='button'
                            variant={grouped ? 'secondary' : 'outline'}
                            size='sm'
                            aria-pressed={grouped}
                            onClick={() => setGrouped(!grouped)}>
                            创作分组
                        </Button>
                    </div>
                    {filtered.length === 0 ? (
                        <div className='px-5 py-8 text-center'>
                            <p className='text-muted-foreground text-sm'>没有找到匹配的记录</p>
                            <Button
                                type='button'
                                variant='link'
                                onClick={() => {
                                    setQuery('');
                                    setFilter('all');
                                }}>
                                清除筛选
                            </Button>
                        </div>
                    ) : (
                        <div className='space-y-5 px-4 pb-5 sm:px-5'>
                            {groups.map((group) => (
                                <div
                                    key={group.id}
                                    className={grouped ? 'border-border space-y-3 rounded-xl border p-3' : ''}>
                                    {grouped && (
                                        <div className='text-muted-foreground flex flex-wrap justify-between gap-2 text-xs'>
                                            <span>
                                                {formatTime(group.endTimestamp)} · {group.items.length} 次创作
                                            </span>
                                            <span>生成与后续编辑保留在同一组</span>
                                        </div>
                                    )}
                                    <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'>
                                        {group.items.map((item) => (
                                            <article
                                                key={item.id}
                                                className={cn(
                                                    'bg-background/35 min-w-0 overflow-hidden rounded-xl border transition-colors',
                                                    selectedId === item.id
                                                        ? 'border-primary ring-primary/30 ring-1'
                                                        : 'border-border'
                                                )}>
                                                <button
                                                    type='button'
                                                    disabled={disabled}
                                                    onClick={() => onSelect(item)}
                                                    aria-label={`查看作品：${item.prompt.slice(0, 40) || formatTime(item.timestamp)}`}
                                                    aria-pressed={selectedId === item.id}
                                                    className='bg-muted/20 focus-visible:ring-ring relative block aspect-[4/3] w-full overflow-hidden focus-visible:ring-2 focus-visible:ring-inset'>
                                                    <StoredImage
                                                        filename={item.coverImageFilename || item.images[0].filename}
                                                        storageMode={item.storageModeUsed}
                                                        alt={item.prompt || '历史作品'}
                                                        className='h-full w-full object-cover'
                                                    />
                                                    <span className='absolute top-2 left-2 rounded-md bg-black/65 px-1.5 py-1 text-[10px] text-white'>
                                                        {item.mode === 'edit' ? '编辑' : '生成'}
                                                        {item.images.length > 1 && ` · ${item.images.length} 张`}
                                                    </span>
                                                </button>
                                                <div className='space-y-2 p-2.5'>
                                                    <p className='line-clamp-2 min-h-9 text-xs leading-[18px] break-words'>
                                                        {item.prompt || '未记录提示词'}
                                                    </p>
                                                    <p className='text-muted-foreground text-[10px]'>
                                                        {formatTime(item.timestamp)} ·{' '}
                                                        {(item.durationMs / 1000).toFixed(0)} 秒
                                                    </p>
                                                    <div className='flex flex-wrap items-center justify-between gap-1'>
                                                        <Button
                                                            type='button'
                                                            variant='ghost'
                                                            size='sm'
                                                            className='h-8 px-1.5 text-xs'
                                                            onClick={() => {
                                                                setDetail(item);
                                                                setCopied(false);
                                                                setCopyError(false);
                                                            }}>
                                                            <FileText className='h-3.5 w-3.5' />
                                                            详情
                                                        </Button>
                                                        <div className='flex'>
                                                            <Button
                                                                type='button'
                                                                variant='ghost'
                                                                size='icon'
                                                                className='h-8 w-8'
                                                                disabled={disabled}
                                                                aria-label='复用此作品的提示词和参数'
                                                                onClick={() => onRestore(item)}>
                                                                <RotateCcw className='h-3.5 w-3.5' />
                                                            </Button>
                                                            <Button
                                                                type='button'
                                                                variant='ghost'
                                                                size='icon'
                                                                className='text-muted-foreground hover:text-destructive h-8 w-8'
                                                                disabled={disabled}
                                                                aria-label='删除此作品'
                                                                onClick={() => onDelete(item)}>
                                                                <Trash2 className='h-3.5 w-3.5' />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {filtered.length > limit && (
                                <div className='text-center'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        onClick={() => setLimit((current) => current + 24)}>
                                        加载更多（还有 {filtered.length - limit} 条）
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
            <Dialog
                open={!!detail}
                onOpenChange={(open) => {
                    if (!open) setDetail(null);
                }}>
                <DialogContent className='sm:max-w-[600px]'>
                    <DialogHeader>
                        <DialogTitle>创作详情</DialogTitle>
                        <DialogDescription>
                            {detail &&
                                `${formatTime(detail.timestamp)} · ${detail.mode === 'edit' ? '编辑' : '生成'} ${detail.images.length} 张图片`}
                        </DialogDescription>
                    </DialogHeader>
                    {detail && (
                        <>
                            <p className='border-border bg-muted/25 max-h-[30dvh] overflow-y-auto rounded-xl border p-3 text-sm leading-6 break-words whitespace-pre-wrap'>
                                {detail.prompt || '未记录提示词'}
                            </p>
                            <dl className='grid grid-cols-2 gap-2 text-xs'>
                                {detail.presetTitle && (
                                    <>
                                        <dt className='text-muted-foreground'>使用模板</dt>
                                        <dd>
                                            {detail.presetCategory ? `${detail.presetCategory} · ` : ''}
                                            {detail.presetTitle}
                                        </dd>
                                    </>
                                )}
                                <dt className='text-muted-foreground'>模型</dt>
                                <dd className='break-all'>{detail.model}</dd>
                                <dt className='text-muted-foreground'>尺寸</dt>
                                <dd>
                                    {detail.settings
                                        ? getRequestSize(detail.settings).replace('auto', '自动').replace('x', ' × ')
                                        : '旧记录未保存尺寸'}
                                </dd>
                                <dt className='text-muted-foreground'>图像质量 / 格式</dt>
                                <dd>
                                    {{ auto: '自动', low: '低', medium: '中', high: '高' }[detail.quality]} /{' '}
                                    {detail.output_format?.toUpperCase() || 'PNG'}
                                </dd>
                                <dt className='text-muted-foreground'>处理时间</dt>
                                <dd>{(detail.durationMs / 1000).toFixed(1)} 秒</dd>
                            </dl>
                            <div className='border-border space-y-2 border-t pt-3 text-xs'>
                                <p className='font-medium'>费用与用量</p>
                                {detail.costDetails ? (
                                    <>
                                        <p className='text-muted-foreground'>
                                            文本输入 {detail.costDetails.text_input_tokens.toLocaleString()} · 图片输入{' '}
                                            {detail.costDetails.image_input_tokens.toLocaleString()} · 图片输出{' '}
                                            {detail.costDetails.image_output_tokens.toLocaleString()} 个令牌
                                        </p>
                                        <p>
                                            估算费用 ${detail.costDetails.estimated_cost_usd.toFixed(4)}
                                            （实际费用以服务商为准）
                                        </p>
                                    </>
                                ) : (
                                    <p className='text-muted-foreground'>
                                        未提供用量或缺少对应模型的价格，无法估算本次费用。
                                    </p>
                                )}
                            </div>
                            {copyError && (
                                <p role='alert' className='text-destructive text-xs'>
                                    复制失败，请在上方选中提示词手动复制。
                                </p>
                            )}
                            <DialogFooter>
                                <Button
                                    type='button'
                                    variant='outline'
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(detail.prompt);
                                            setCopied(true);
                                            setCopyError(false);
                                            if (copyTimer.current) clearTimeout(copyTimer.current);
                                            copyTimer.current = setTimeout(() => setCopied(false), 2000);
                                        } catch {
                                            setCopyError(true);
                                        }
                                    }}>
                                    {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                                    {copied ? '已复制' : '复制提示词'}
                                </Button>
                                <Button
                                    type='button'
                                    disabled={disabled}
                                    onClick={() => {
                                        onRestore(detail);
                                        setDetail(null);
                                    }}>
                                    <RotateCcw className='h-4 w-4' />
                                    复用参数
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
