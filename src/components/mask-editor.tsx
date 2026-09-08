'use client';

/* eslint-disable @next/next/no-img-element */
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MAX_IMAGE_BYTES } from '@/lib/image-settings';
import { ChevronDown, Eraser, Undo2, Upload } from 'lucide-react';
import * as React from 'react';

type Point = { x: number; y: number; radius: number };
export type MaskEditorHandle = { getMask: () => Promise<File | null> };

function paintStroke(ctx: CanvasRenderingContext2D, points: Point[]) {
    if (!points.length) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, points[0].radius, 0, 2 * Math.PI);
    ctx.fill();
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineWidth = points[0].radius * 2;
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
}

export const MaskEditor = React.forwardRef<MaskEditorHandle, { sourceUrl: string; disabled: boolean }>(
    function MaskEditor({ sourceUrl, disabled }, ref) {
        const [dimensions, setDimensions] = React.useState<{ width: number; height: number } | null>(null);
        const [strokes, setStrokes] = React.useState<Point[][]>([]);
        const [brushSize, setBrushSize] = React.useState(30);
        const [uploaded, setUploaded] = React.useState<{ file: File; image: HTMLImageElement; url: string } | null>(
            null
        );
        const [error, setError] = React.useState<string | null>(null);
        const canvas = React.useRef<HTMLCanvasElement>(null);
        const activeStroke = React.useRef<Point[] | null>(null);
        const input = React.useRef<HTMLInputElement>(null);
        const mounted = React.useRef(true);
        const uploadVersion = React.useRef(0);

        React.useEffect(() => {
            mounted.current = true;
            const image = new Image();
            image.onload = () => setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => setError('底图无法读取，请重新添加图片。');
            image.src = sourceUrl;
            return () => {
                mounted.current = false;
                image.onload = null;
                image.onerror = null;
            };
        }, [sourceUrl]);
        React.useEffect(
            () => () => {
                if (uploaded) URL.revokeObjectURL(uploaded.url);
            },
            [uploaded]
        );

        React.useEffect(() => {
            const ctx = canvas.current?.getContext('2d');
            if (!ctx || !dimensions) return;
            ctx.clearRect(0, 0, dimensions.width, dimensions.height);
            if (uploaded) {
                ctx.drawImage(uploaded.image, 0, 0);
                ctx.globalCompositeOperation = 'source-out';
                ctx.fillStyle = '#fb7185';
                ctx.fillRect(0, 0, dimensions.width, dimensions.height);
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.fillStyle = '#fb7185';
            ctx.strokeStyle = '#fb7185';
            strokes.forEach((stroke) => paintStroke(ctx, stroke));
        }, [strokes, dimensions, uploaded]);

        React.useImperativeHandle(
            ref,
            () => ({
                async getMask() {
                    if (!uploaded && strokes.length === 0) return null;
                    if (!dimensions) throw new Error('底图仍在读取，请稍后提交。');
                    if (!strokes.length && uploaded) return uploaded.file;
                    const target = document.createElement('canvas');
                    target.width = dimensions.width;
                    target.height = dimensions.height;
                    const ctx = target.getContext('2d');
                    if (!ctx) throw new Error('浏览器无法生成遮罩，请重新打开页面。');
                    if (uploaded) ctx.drawImage(uploaded.image, 0, 0);
                    else {
                        ctx.fillStyle = '#000';
                        ctx.fillRect(0, 0, target.width, target.height);
                    }
                    ctx.globalCompositeOperation = 'destination-out';
                    strokes.forEach((stroke) => paintStroke(ctx, stroke));
                    const blob = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, 'image/png'));
                    if (!blob) throw new Error('遮罩生成失败，请重试。');
                    return new File([blob], 'generated-mask.png', { type: 'image/png' });
                }
            }),
            [dimensions, strokes, uploaded]
        );

        const pointAt = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const scale = event.currentTarget.width / bounds.width;
            return {
                x: (event.clientX - bounds.left) * scale,
                y: ((event.clientY - bounds.top) * event.currentTarget.height) / bounds.height,
                radius: (brushSize * scale) / 2
            };
        };
        const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file || !dimensions || disabled) return;
            if (file.type !== 'image/png' || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
                setError('遮罩需为有效的 PNG 图片，且小于 50 MB。');
                return;
            }
            const version = ++uploadVersion.current;
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                if (!mounted.current || version !== uploadVersion.current) {
                    URL.revokeObjectURL(url);
                    return;
                }
                if (image.naturalWidth !== dimensions.width || image.naturalHeight !== dimensions.height) {
                    setError(`遮罩需与底图一致：${dimensions.width} × ${dimensions.height} 像素。`);
                    URL.revokeObjectURL(url);
                    return;
                }
                setUploaded({ file, image, url });
                setStrokes([]);
                setError(null);
            };
            image.onerror = () => {
                if (mounted.current) setError('遮罩文件无法读取，请选择其他 PNG 图片。');
                URL.revokeObjectURL(url);
            };
            image.src = url;
        };

        return (
            <details className='group/mask border-border bg-background/30 rounded-xl border'>
                <summary className='focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl p-3 text-sm focus-visible:ring-2'>
                    <span>
                        局部修改 <span className='text-muted-foreground text-xs'>（可选）</span>
                    </span>
                    <span className='text-primary ml-auto text-xs'>
                        {strokes.length || uploaded ? '选区将在提交时自动应用' : '涂抹需要修改的区域'}
                    </span>
                    <ChevronDown className='h-4 w-4 shrink-0 transition-transform group-open/mask:rotate-180' />
                </summary>
                <div className='border-border space-y-3 border-t p-3'>
                    <p className='text-muted-foreground text-xs leading-5'>
                        在第一张图片上涂抹需要修改的区域。粉色代表修改范围，无需另行保存；也可以上传透明区域代表修改范围的
                        PNG 遮罩。
                    </p>
                    {dimensions && (
                        <div
                            className='border-border relative overflow-hidden rounded-lg border'
                            style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
                            <img src={sourceUrl} alt='局部修改底图' className='block h-full w-full object-contain' />
                            <canvas
                                ref={canvas}
                                width={dimensions.width}
                                height={dimensions.height}
                                aria-label='涂抹需要修改的区域，也可使用下方上传遮罩按钮'
                                className='absolute inset-0 h-full w-full touch-none opacity-50'
                                style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
                                onPointerDown={(event) => {
                                    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
                                    event.preventDefault();
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                    activeStroke.current = [pointAt(event)];
                                    setStrokes((current) => [...current, activeStroke.current!]);
                                }}
                                onPointerMove={(event) => {
                                    if (disabled || !activeStroke.current) return;
                                    const next = [...activeStroke.current, pointAt(event)];
                                    activeStroke.current = next;
                                    setStrokes((current) => [...current.slice(0, -1), next]);
                                }}
                                onPointerUp={() => {
                                    activeStroke.current = null;
                                }}
                                onPointerCancel={() => {
                                    activeStroke.current = null;
                                }}
                                onLostPointerCapture={() => {
                                    activeStroke.current = null;
                                }}
                            />
                        </div>
                    )}
                    <div className='space-y-2'>
                        <Label htmlFor='mask-brush'>笔刷大小：{brushSize}</Label>
                        <input
                            id='mask-brush'
                            type='range'
                            min={5}
                            max={100}
                            value={brushSize}
                            disabled={disabled}
                            onChange={(event) => setBrushSize(Number(event.target.value))}
                            className='accent-primary w-full'
                        />
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={disabled || !dimensions}
                            onClick={() => input.current?.click()}>
                            <Upload className='h-4 w-4' />
                            上传遮罩
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={disabled || !strokes.length}
                            onClick={() => setStrokes((current) => current.slice(0, -1))}>
                            <Undo2 className='h-4 w-4' />
                            撤销笔画
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            disabled={disabled || (!strokes.length && !uploaded)}
                            onClick={() => {
                                uploadVersion.current++;
                                setStrokes([]);
                                setUploaded(null);
                                setError(null);
                            }}>
                            <Eraser className='h-4 w-4' />
                            清除选区
                        </Button>
                        <input
                            ref={input}
                            type='file'
                            accept='image/png'
                            aria-label='上传 PNG 遮罩'
                            className='sr-only'
                            disabled={disabled}
                            onChange={handleUpload}
                        />
                    </div>
                    {uploaded && (
                        <p className='text-muted-foreground text-xs break-all'>
                            已加载 {uploaded.file.name}，继续涂抹可扩展修改区域。
                        </p>
                    )}
                    {error && (
                        <p role='alert' className='text-destructive text-xs'>
                            {error}
                        </p>
                    )}
                </div>
            </details>
        );
    }
);
