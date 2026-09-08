'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { IMAGE_MODELS, type ImageMode, type ImageSettings } from '@/lib/image-settings';
import { getPresetDimensions, validateGptImage2Size } from '@/lib/size-utils';
import { ChevronDown, Settings2 } from 'lucide-react';

type Props = {
    value: ImageSettings;
    onChange: (patch: Partial<ImageSettings>) => void;
    disabled: boolean;
    mode: ImageMode;
};
const selectClass =
    'h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export function ImageOptions({ value, onChange, disabled, mode }: Props) {
    const isGptImage2 = value.model === 'gpt-image-2';
    const sizeError =
        value.size === 'custom' ? validateGptImage2Size(value.customWidth, value.customHeight) : { valid: true };
    const canStream = isGptImage2 && value.n === 1;
    const sizes = [
        { value: 'auto', label: '自动', hint: '由模型选择' },
        { value: 'square', label: '正方形', hint: '1 : 1' },
        { value: 'landscape', label: '横向', hint: '3 : 2' },
        { value: 'portrait', label: '纵向', hint: '2 : 3' }
    ] as const;

    return (
        <div className='space-y-5'>
            <div className='grid grid-cols-[minmax(0,1fr)_100px] gap-3'>
                <div className='space-y-2'>
                    <Label htmlFor={`${mode}-model`}>模型</Label>
                    <select
                        id={`${mode}-model`}
                        value={value.model}
                        onChange={(event) => onChange({ model: event.target.value as ImageSettings['model'] })}
                        disabled={disabled}
                        className={selectClass}>
                        {IMAGE_MODELS.map((model) => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))}
                    </select>
                </div>
                <div className='space-y-2'>
                    <Label htmlFor={`${mode}-count`}>图片数量</Label>
                    <select
                        id={`${mode}-count`}
                        value={value.n}
                        onChange={(event) => onChange({ n: Number(event.target.value) })}
                        disabled={disabled}
                        className={selectClass}>
                        {Array.from({ length: 10 }, (_, index) => (
                            <option key={index} value={index + 1}>
                                {index + 1} 张
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <fieldset className='min-w-0 space-y-2'>
                <legend className='mb-2 text-sm font-medium'>画面尺寸</legend>
                <RadioGroup
                    aria-label='画面尺寸'
                    value={value.size}
                    onValueChange={(size) => onChange({ size: size as ImageSettings['size'] })}
                    disabled={disabled}
                    className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                    {sizes.map((size) => (
                        <div key={size.value} className='relative'>
                            <RadioGroupItem
                                id={`${mode}-size-${size.value}`}
                                value={size.value}
                                className='peer sr-only'
                            />
                            <Label
                                htmlFor={`${mode}-size-${size.value}`}
                                className='border-border bg-background/40 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary peer-focus-visible:ring-ring flex cursor-pointer flex-col gap-1 rounded-lg border px-2 py-2.5 text-center transition-colors peer-focus-visible:ring-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50'>
                                <span>{size.label}</span>
                                <span className='text-muted-foreground text-[11px] font-normal'>{size.hint}</span>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
                <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs'>
                    <span>
                        {value.size === 'custom'
                            ? `${value.customWidth} × ${value.customHeight} 像素`
                            : getPresetDimensions(value.size, value.model)?.replace('x', ' × ') ||
                              '根据画面内容自动决定尺寸'}
                    </span>
                    {isGptImage2 && (
                        <button
                            type='button'
                            disabled={disabled}
                            onClick={() => onChange({ size: value.size === 'custom' ? 'auto' : 'custom' })}
                            aria-expanded={value.size === 'custom'}
                            className='text-primary focus-visible:ring-ring rounded px-1 py-1 hover:underline focus-visible:ring-2'>
                            自定义尺寸
                        </button>
                    )}
                </div>
                {isGptImage2 && value.size === 'custom' && (
                    <div className='border-border bg-background/40 space-y-2 rounded-xl border p-3'>
                        <div className='grid grid-cols-2 gap-3'>
                            <div className='space-y-2'>
                                <Label htmlFor={`${mode}-width`}>宽度（像素）</Label>
                                <Input
                                    id={`${mode}-width`}
                                    type='number'
                                    inputMode='numeric'
                                    min={16}
                                    max={3840}
                                    step={16}
                                    disabled={disabled}
                                    value={value.customWidth || ''}
                                    onChange={(event) => onChange({ customWidth: Number(event.target.value) })}
                                    aria-invalid={!sizeError.valid}
                                    aria-describedby={`${mode}-size-help`}
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor={`${mode}-height`}>高度（像素）</Label>
                                <Input
                                    id={`${mode}-height`}
                                    type='number'
                                    inputMode='numeric'
                                    min={16}
                                    max={3840}
                                    step={16}
                                    disabled={disabled}
                                    value={value.customHeight || ''}
                                    onChange={(event) => onChange({ customHeight: Number(event.target.value) })}
                                    aria-invalid={!sizeError.valid}
                                    aria-describedby={`${mode}-size-help`}
                                />
                            </div>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            {[
                                ['2K 方图', 2048, 2048],
                                ['4K 横图', 3840, 2160],
                                ['4K 竖图', 2160, 3840]
                            ].map(([label, width, height]) => (
                                <button
                                    key={label}
                                    type='button'
                                    disabled={disabled}
                                    className='border-border hover:bg-muted rounded border px-2 py-1 text-xs'
                                    onClick={() =>
                                        onChange({ customWidth: Number(width), customHeight: Number(height) })
                                    }>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <p
                            id={`${mode}-size-help`}
                            className={`text-xs leading-5 ${sizeError.valid ? 'text-muted-foreground' : 'text-destructive'}`}
                            role={sizeError.valid ? undefined : 'alert'}>
                            {!sizeError.valid && 'reason' in sizeError
                                ? sizeError.reason
                                : '宽高需为 16 的倍数，单边最大 3840 像素；更大的图片通常需要更长时间。'}
                        </p>
                    </div>
                )}
            </fieldset>
            <details className='group border-border/80 bg-background/25 rounded-xl border'>
                <summary className='focus-visible:ring-ring flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-3 text-sm focus-visible:ring-2'>
                    <Settings2 className='text-muted-foreground h-4 w-4' />
                    <span className='font-medium'>更多设置</span>
                    <span className='text-muted-foreground ml-auto text-xs'>
                        {value.quality === 'auto'
                            ? '自动质量'
                            : { low: '低质量', medium: '中等质量', high: '高质量' }[value.quality]}{' '}
                        · {mode === 'edit' ? 'PNG' : value.output_format.toUpperCase()}
                    </span>
                    <ChevronDown className='text-muted-foreground h-4 w-4 transition-transform group-open:rotate-180' />
                </summary>
                <div className='border-border/70 space-y-4 border-t p-3'>
                    <div className='grid grid-cols-2 gap-3'>
                        <div className='space-y-2'>
                            <Label htmlFor={`${mode}-quality`}>图像质量</Label>
                            <select
                                id={`${mode}-quality`}
                                disabled={disabled}
                                className={selectClass}
                                value={value.quality}
                                onChange={(event) =>
                                    onChange({ quality: event.target.value as ImageSettings['quality'] })
                                }>
                                <option value='auto'>自动</option>
                                <option value='low'>低 · 更快</option>
                                <option value='medium'>中 · 均衡</option>
                                <option value='high'>高 · 更多细节</option>
                            </select>
                        </div>
                        {mode === 'generate' && (
                            <div className='space-y-2'>
                                <Label htmlFor={`${mode}-format`}>输出格式</Label>
                                <select
                                    id={`${mode}-format`}
                                    disabled={disabled}
                                    className={selectClass}
                                    value={value.output_format}
                                    onChange={(event) =>
                                        onChange({
                                            output_format: event.target.value as ImageSettings['output_format'],
                                            ...(event.target.value === 'jpeg' ? { background: 'auto' as const } : {})
                                        })
                                    }>
                                    <option value='png'>PNG</option>
                                    <option value='jpeg'>JPEG</option>
                                    <option value='webp'>WebP</option>
                                </select>
                            </div>
                        )}
                    </div>
                    {mode === 'generate' && value.output_format !== 'png' && (
                        <div className='space-y-2'>
                            <Label htmlFor={`${mode}-compression`}>压缩质量：{value.output_compression}%</Label>
                            <input
                                className='accent-primary w-full'
                                id={`${mode}-compression`}
                                type='range'
                                min={0}
                                max={100}
                                value={value.output_compression}
                                disabled={disabled}
                                onChange={(event) => onChange({ output_compression: Number(event.target.value) })}
                            />
                            <p className='text-muted-foreground text-xs'>数值越高，细节越多，文件也越大。</p>
                        </div>
                    )}
                    {mode === 'generate' && !isGptImage2 && (
                        <div className='space-y-2'>
                            <Label htmlFor={`${mode}-background`}>背景</Label>
                            <select
                                id={`${mode}-background`}
                                disabled={disabled}
                                className={selectClass}
                                value={value.background}
                                onChange={(event) =>
                                    onChange({ background: event.target.value as ImageSettings['background'] })
                                }>
                                <option value='auto'>自动</option>
                                <option value='opaque'>不透明</option>
                                <option value='transparent'>透明（PNG / WebP）</option>
                            </select>
                        </div>
                    )}
                    {mode === 'generate' && (
                        <div className='space-y-2'>
                            <Label htmlFor={`${mode}-moderation`}>内容审核</Label>
                            <select
                                id={`${mode}-moderation`}
                                disabled={disabled}
                                className={selectClass}
                                value={value.moderation}
                                onChange={(event) =>
                                    onChange({ moderation: event.target.value as ImageSettings['moderation'] })
                                }>
                                <option value='auto'>自动</option>
                                <option value='low'>较宽松</option>
                            </select>
                        </div>
                    )}
                    <div className='space-y-2'>
                        <div className='flex items-center gap-2'>
                            <Checkbox
                                id={`${mode}-stream`}
                                checked={value.stream}
                                disabled={disabled || !canStream}
                                onCheckedChange={(checked) => onChange({ stream: checked === true })}
                            />
                            <Label htmlFor={`${mode}-stream`}>生成过程中显示预览</Label>
                        </div>
                        <p className='text-muted-foreground text-xs leading-5'>
                            {canStream
                                ? '边生成边查看画面，需接口支持；预览可能产生额外费用。'
                                : '此功能需要 gpt-image-2，且每次仅生成 1 张图片。'}
                        </p>
                        {value.stream && (
                            <div className='space-y-2'>
                                <Label htmlFor={`${mode}-partial`}>预览次数</Label>
                                <select
                                    id={`${mode}-partial`}
                                    className={selectClass}
                                    disabled={disabled}
                                    value={value.partial_images}
                                    onChange={(event) =>
                                        onChange({ partial_images: Number(event.target.value) as 1 | 2 | 3 })
                                    }>
                                    {[1, 2, 3].map((number) => (
                                        <option key={number} value={number}>
                                            {number} 次
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </details>
        </div>
    );
}
