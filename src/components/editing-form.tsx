'use client';

import { AcademicPromptPicker } from '@/components/academic-prompt-picker';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getPresetTooltip, validateGptImage2Size } from '@/lib/size-utils';
import {
    Upload,
    Eraser,
    Save,
    Square,
    RectangleHorizontal,
    RectangleVertical,
    Sparkles,
    Tally1,
    Tally2,
    Tally3,
    Loader2,
    X,
    ScanEye,
    UploadCloud,
    Lock,
    LockOpen,
    HelpCircle,
    SquareDashed,
    Info
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

import type { GptImageModel } from '@/lib/cost-utils';
import { getAcademicPromptsForMode, type PromptTemplate } from '@/lib/preset-prompts';
import type { SizePreset } from '@/lib/size-utils';

export type EditingFormData = {
    prompt: string;
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: 'low' | 'medium' | 'high' | 'auto';
    imageFiles: File[];
    maskFile: File | null;
    model: GptImageModel;
};

type EditingFormProps = {
    onSubmit: (data: EditingFormData) => void;
    isLoading: boolean;
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    editModel: EditingFormData['model'];
    setEditModel: React.Dispatch<React.SetStateAction<EditingFormData['model']>>;
    imageFiles: File[];
    sourceImagePreviewUrls: string[];
    setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
    setSourceImagePreviewUrls: React.Dispatch<React.SetStateAction<string[]>>;
    maxImages: number;
    editPrompt: string;
    setEditPrompt: React.Dispatch<React.SetStateAction<string>>;
    editN: number[];
    setEditN: React.Dispatch<React.SetStateAction<number[]>>;
    editSize: EditingFormData['size'];
    setEditSize: React.Dispatch<React.SetStateAction<EditingFormData['size']>>;
    editCustomWidth: number;
    setEditCustomWidth: React.Dispatch<React.SetStateAction<number>>;
    editCustomHeight: number;
    setEditCustomHeight: React.Dispatch<React.SetStateAction<number>>;
    editQuality: EditingFormData['quality'];
    setEditQuality: React.Dispatch<React.SetStateAction<EditingFormData['quality']>>;
    editBrushSize: number[];
    setEditBrushSize: React.Dispatch<React.SetStateAction<number[]>>;
    editShowMaskEditor: boolean;
    setEditShowMaskEditor: React.Dispatch<React.SetStateAction<boolean>>;
    editGeneratedMaskFile: File | null;
    setEditGeneratedMaskFile: React.Dispatch<React.SetStateAction<File | null>>;
    editIsMaskSaved: boolean;
    setEditIsMaskSaved: React.Dispatch<React.SetStateAction<boolean>>;
    editOriginalImageSize: { width: number; height: number } | null;
    setEditOriginalImageSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
    editDrawnPoints: DrawnPoint[];
    setEditDrawnPoints: React.Dispatch<React.SetStateAction<DrawnPoint[]>>;
    editMaskPreviewUrl: string | null;
    setEditMaskPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
    enableStreaming: boolean;
    setEnableStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    partialImages: 1 | 2 | 3;
    setPartialImages: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
    onPresetSelect?: (preset: PromptTemplate | null) => void;
};

const RadioItemWithIcon = ({
    value,
    id,
    label,
    Icon
}: {
    value: string;
    id: string;
    label: string;
    Icon: React.ElementType;
}) => (
    <div className='flex items-center space-x-2'>
        <RadioGroupItem
            value={value}
            id={id}
            className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
        />
        <Label htmlFor={id} className='flex cursor-pointer items-center gap-2 text-base text-white/80'>
            <Icon className='h-5 w-5 text-white/60' />
            {label}
        </Label>
    </div>
);

export function EditingForm({
    onSubmit,
    isLoading,
    currentMode,
    onModeChange,
    isPasswordRequiredByBackend,
    clientPasswordHash,
    onOpenPasswordDialog,
    editModel,
    setEditModel,
    imageFiles,
    sourceImagePreviewUrls,
    setImageFiles,
    setSourceImagePreviewUrls,
    maxImages,
    editPrompt,
    setEditPrompt,
    editN,
    setEditN,
    editSize,
    setEditSize,
    editCustomWidth,
    setEditCustomWidth,
    editCustomHeight,
    setEditCustomHeight,
    editQuality,
    setEditQuality,
    editBrushSize,
    setEditBrushSize,
    editShowMaskEditor,
    setEditShowMaskEditor,
    editGeneratedMaskFile,
    setEditGeneratedMaskFile,
    editIsMaskSaved,
    setEditIsMaskSaved,
    editOriginalImageSize,
    setEditOriginalImageSize,
    editDrawnPoints,
    setEditDrawnPoints,
    editMaskPreviewUrl,
    setEditMaskPreviewUrl,
    enableStreaming,
    setEnableStreaming,
    partialImages,
    setPartialImages,
    onPresetSelect
}: EditingFormProps) {
    const [firstImagePreviewUrl, setFirstImagePreviewUrl] = React.useState<string | null>(null);

    const isGptImage2 = editModel === 'gpt-image-2';
    const customSizeValidation =
        editSize === 'custom'
            ? validateGptImage2Size(editCustomWidth, editCustomHeight)
            : { valid: true as const };
    const customSizeInvalid = editSize === 'custom' && !customSizeValidation.valid;
    const academicPrompts = React.useMemo(() => getAcademicPromptsForMode('edit'), []);

    const applyPresetRecommendations = (preset: PromptTemplate) => {
        if (preset.recommendedSize) {
            setEditSize(preset.recommendedSize);
        }
        if (preset.recommendedQuality) {
            setEditQuality(preset.recommendedQuality);
        }
        onPresetSelect?.(preset);
    };

    const handleReplacePreset = (preset: PromptTemplate) => {
        setEditPrompt(preset.text);
        applyPresetRecommendations(preset);
    };

    const handleAppendPreset = (preset: PromptTemplate) => {
        setEditPrompt((current) => (current.trim() ? `${current.trim()}\n\n${preset.text}` : preset.text));
        applyPresetRecommendations(preset);
    };

    // Disable streaming when editN > 1 (OpenAI limitation)
    React.useEffect(() => {
        if (editN[0] > 1 && enableStreaming) {
            setEnableStreaming(false);
        }
    }, [editN, enableStreaming, setEnableStreaming]);

    // 'custom' is only valid on gpt-image-2; reset when switching to a legacy model
    React.useEffect(() => {
        if (!isGptImage2 && editSize === 'custom') {
            setEditSize('auto');
        }
    }, [isGptImage2, editSize, setEditSize]);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const visualFeedbackCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const isDrawing = React.useRef(false);
    const lastPos = React.useRef<{ x: number; y: number } | null>(null);
    const maskInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (editOriginalImageSize) {
            if (!visualFeedbackCanvasRef.current) {
                visualFeedbackCanvasRef.current = document.createElement('canvas');
            }
            visualFeedbackCanvasRef.current.width = editOriginalImageSize.width;
            visualFeedbackCanvasRef.current.height = editOriginalImageSize.height;
        }
    }, [editOriginalImageSize]);

    React.useEffect(() => {
        setEditGeneratedMaskFile(null);
        setEditIsMaskSaved(false);
        setEditOriginalImageSize(null);
        setFirstImagePreviewUrl(null);
        setEditDrawnPoints([]);
        setEditMaskPreviewUrl(null);

        if (imageFiles.length > 0 && sourceImagePreviewUrls.length > 0) {
            const img = new window.Image();
            img.onload = () => {
                setEditOriginalImageSize({ width: img.width, height: img.height });
            };
            img.src = sourceImagePreviewUrls[0];
            setFirstImagePreviewUrl(sourceImagePreviewUrls[0]);
        } else {
            setEditShowMaskEditor(false);
        }
    }, [
        imageFiles,
        sourceImagePreviewUrls,
        setEditGeneratedMaskFile,
        setEditIsMaskSaved,
        setEditOriginalImageSize,
        setEditDrawnPoints,
        setEditMaskPreviewUrl,
        setEditShowMaskEditor
    ]);

    React.useEffect(() => {
        const displayCtx = canvasRef.current?.getContext('2d');
        const displayCanvas = canvasRef.current;
        const feedbackCanvas = visualFeedbackCanvasRef.current;

        if (!displayCtx || !displayCanvas || !feedbackCanvas || !editOriginalImageSize) return;

        const feedbackCtx = feedbackCanvas.getContext('2d');
        if (!feedbackCtx) return;

        feedbackCtx.clearRect(0, 0, feedbackCanvas.width, feedbackCanvas.height);
        feedbackCtx.fillStyle = 'red';
        editDrawnPoints.forEach((point) => {
            feedbackCtx.beginPath();
            feedbackCtx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
            feedbackCtx.fill();
        });

        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.save();
        displayCtx.globalAlpha = 0.5;
        displayCtx.drawImage(feedbackCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.restore();
    }, [editDrawnPoints, editOriginalImageSize]);

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const addPoint = (x: number, y: number) => {
        setEditDrawnPoints((prevPoints) => [...prevPoints, { x, y, size: editBrushSize[0] }]);
        setEditIsMaskSaved(false);
        setEditMaskPreviewUrl(null);
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const currentPos = getMousePos(e);
        if (!currentPos) return;
        lastPos.current = currentPos;
        addPoint(currentPos.x, currentPos.y);
    };

    const drawLine = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const currentPos = getMousePos(e);
        if (!currentPos || !lastPos.current) return;

        const dist = Math.hypot(currentPos.x - lastPos.current.x, currentPos.y - lastPos.current.y);
        const angle = Math.atan2(currentPos.y - lastPos.current.y, currentPos.x - lastPos.current.x);
        const step = Math.max(1, editBrushSize[0] / 4);

        for (let i = step; i < dist; i += step) {
            const x = lastPos.current.x + Math.cos(angle) * i;
            const y = lastPos.current.y + Math.sin(angle) * i;
            addPoint(x, y);
        }
        addPoint(currentPos.x, currentPos.y);

        lastPos.current = currentPos;
    };

    const drawMaskStroke = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        lastPos.current = null;
    };

    const handleClearMask = () => {
        setEditDrawnPoints([]);
        setEditGeneratedMaskFile(null);
        setEditIsMaskSaved(false);
        setEditMaskPreviewUrl(null);
    };

    const generateAndSaveMask = () => {
        if (!editOriginalImageSize || editDrawnPoints.length === 0) {
            setEditGeneratedMaskFile(null);
            setEditIsMaskSaved(false);
            setEditMaskPreviewUrl(null);
            return;
        }

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = editOriginalImageSize.width;
        offscreenCanvas.height = editOriginalImageSize.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');

        if (!offscreenCtx) return;

        offscreenCtx.fillStyle = '#000000';
        offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        offscreenCtx.globalCompositeOperation = 'destination-out';
        editDrawnPoints.forEach((point) => {
            drawMaskStroke(offscreenCtx, point.x, point.y, point.size);
        });

        try {
            const dataUrl = offscreenCanvas.toDataURL('image/png');
            setEditMaskPreviewUrl(dataUrl);
        } catch (e) {
            console.error('Error generating mask preview data URL:', e);
            setEditMaskPreviewUrl(null);
        }

        offscreenCanvas.toBlob((blob) => {
            if (blob) {
                const maskFile = new File([blob], 'generated-mask.png', { type: 'image/png' });
                setEditGeneratedMaskFile(maskFile);
                setEditIsMaskSaved(true);
            } else {
                console.error('Failed to generate mask blob.');
                setEditIsMaskSaved(false);
                setEditMaskPreviewUrl(null);
            }
        }, 'image/png');
    };

    const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files);
            const totalFiles = imageFiles.length + newFiles.length;

            if (totalFiles > maxImages) {
                alert(`你最多只能选择 ${maxImages} 张图片。`);
                const allowedNewFiles = newFiles.slice(0, maxImages - imageFiles.length);
                if (allowedNewFiles.length === 0) {
                    event.target.value = '';
                    return;
                }
                newFiles.splice(allowedNewFiles.length);
            }

            setImageFiles((prevFiles) => [...prevFiles, ...newFiles]);

            const newFilePromises = newFiles.map((file) => {
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(newFilePromises)
                .then((newUrls) => {
                    setSourceImagePreviewUrls((prevUrls) => [...prevUrls, ...newUrls]);
                })
                .catch((error) => {
                    console.error('Error reading new image files:', error);
                });

            event.target.value = '';
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImageFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove));
        setSourceImagePreviewUrls((prevUrls) => prevUrls.filter((_, index) => index !== indexToRemove));
    };

    const handleMaskFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !editOriginalImageSize) {
            event.target.value = '';
            return;
        }

        if (file.type !== 'image/png') {
            alert('无效的文件类型。请上传一个 PNG 文件作为遮罩。');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            if (img.width !== editOriginalImageSize.width || img.height !== editOriginalImageSize.height) {
                alert(
                    `遮罩尺寸 (${img.width}x${img.height}) 必须与原始图像尺寸 (${editOriginalImageSize.width}x${editOriginalImageSize.height}) 相匹配。`
                );
                URL.revokeObjectURL(objectUrl);
                event.target.value = '';
                return;
            }

            setEditGeneratedMaskFile(file);
            setEditIsMaskSaved(true);
            setEditDrawnPoints([]);

            reader.onloadend = () => {
                setEditMaskPreviewUrl(reader.result as string);
                URL.revokeObjectURL(objectUrl);
            };
            reader.onerror = () => {
                console.error('Error reading mask file for preview.');
                setEditMaskPreviewUrl(null);
                URL.revokeObjectURL(objectUrl);
            };
            reader.readAsDataURL(file);

            event.target.value = '';
        };

        img.onerror = () => {
            alert('Failed to load the uploaded mask image to check dimensions.');
            URL.revokeObjectURL(objectUrl);
            event.target.value = '';
        };

        img.src = objectUrl;
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (imageFiles.length === 0) {
            alert('请选择至少一张图像来编辑。');
            return;
        }
        if (editDrawnPoints.length > 0 && !editGeneratedMaskFile && !editIsMaskSaved) {
            alert('请先保存你绘制的遮罩，然后再提交。');
            return;
        }
        if (customSizeInvalid) {
            return;
        }

        const formData: EditingFormData = {
            prompt: editPrompt,
            n: editN[0],
            size: editSize,
            customWidth: editCustomWidth,
            customHeight: editCustomHeight,
            quality: editQuality,
            imageFiles: imageFiles,
            maskFile: editGeneratedMaskFile,
            model: editModel
        };
        onSubmit(formData);
    };

    const displayFileNames = (files: File[]) => {
        if (files.length === 0) return '未选择任何文件。';
        if (files.length === 1) return files[0].name;
        return `已选择 ${files.length} 个文件`;
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-2xl shadow-black/20 backdrop-blur-xl'>
            <CardHeader className='flex items-start justify-between border-b border-border/70 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-semibold'>编辑图片</CardTitle>
                        {isPasswordRequiredByBackend && (
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={onOpenPasswordDialog}
                                className='ml-2 text-muted-foreground hover:text-foreground'
                                aria-label='Configure Password'>
                                {clientPasswordHash ? <Lock className='h-4 w-4' /> : <LockOpen className='h-4 w-4' />}
                            </Button>
                        )}
                    </div>
                    <CardDescription className='mt-1 text-muted-foreground'>修订已有论文图，统一风格、标签、配色和局部结构。</CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    <div className='space-y-1.5'>
                        <Label htmlFor='edit-model-select' className='text-white'>
                            模型
                        </Label>
                        <div className='flex items-center gap-4'>
                            <Select value={editModel} onValueChange={(value) => setEditModel(value as EditingFormData['model'])} disabled={isLoading}>
                                <SelectTrigger
                                    id='edit-model-select'
                                    className='w-[180px] rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                    <SelectValue placeholder='选择模型' />
                                </SelectTrigger>
                                <SelectContent className='border-white/20 bg-black text-white'>
                                    <SelectItem value='gpt-image-2' className='focus:bg-white/10'>
                                        gpt-image-2
                                    </SelectItem>
                                    <SelectItem value='gpt-image-1.5' className='focus:bg-white/10'>
                                        gpt-image-1.5
                                    </SelectItem>
                                    <SelectItem value='gpt-image-1' className='focus:bg-white/10'>
                                        gpt-image-1
                                    </SelectItem>
                                    <SelectItem value='gpt-image-1-mini' className='focus:bg-white/10'>
                                        gpt-image-1-mini
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {isGptImage2 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className='h-4 w-4 cursor-help text-white/40 hover:text-white/60' />
                                    </TooltipTrigger>
                                    <TooltipContent className='max-w-[280px]'>
                                        gpt-image-2 会以高保真方式处理参考图像，适合修订论文图，但会使用更多输入图像令牌。
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className='flex items-center gap-2'>
                                        <Checkbox
                                            id='edit-enable-streaming'
                                            checked={enableStreaming}
                                            onCheckedChange={(checked) => setEnableStreaming(!!checked)}
                                            disabled={isLoading || editN[0] > 1}
                                            className='border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black disabled:cursor-not-allowed disabled:opacity-50'
                                        />
                                        <Label
                                            htmlFor='edit-enable-streaming'
                                            className={`text-sm ${editN[0] > 1 ? 'cursor-not-allowed text-white/40' : 'cursor-pointer text-white/80'}`}>
                                            启用流式处理
                                        </Label>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className='max-w-[250px]'>
                                    {editN[0] > 1
                                        ? '流式处理仅在生成 1 张图像时支持。'
                                        : '在编辑过程中显示部分预览图像，提供更即时的反馈。'}
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {enableStreaming && (
                        <div className='space-y-3'>
                            <div className='flex items-center gap-2'>
                                <Label className='text-white'>预览图像</Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className='h-4 w-4 cursor-help text-white/40 hover:text-white/60' />
                                    </TooltipTrigger>
                                    <TooltipContent className='max-w-[250px]'>
                                        每个预览图像增加约 $0.003 的成本（100 个適外输出令牌）。
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <RadioGroup
                                value={String(partialImages)}
                                onValueChange={(value) => setPartialImages(Number(value) as 1 | 2 | 3)}
                                disabled={isLoading}
                                className='flex gap-x-5'>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='1'
                                        id='edit-partial-1'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-1' className='cursor-pointer text-white/80'>
                                        1
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='2'
                                        id='edit-partial-2'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-2' className='cursor-pointer text-white/80'>
                                        2
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='3'
                                        id='edit-partial-3'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-3' className='cursor-pointer text-white/80'>
                                        3
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}

                    <div className='space-y-1.5'>
                        <Label htmlFor='edit-prompt' className='text-white'>
                            修订说明
                        </Label>
                        <AcademicPromptPicker
                            prompts={academicPrompts}
                            disabled={isLoading}
                            onReplace={handleReplacePreset}
                            onAppend={handleAppendPreset}
                        />
                        <Textarea
                            id='edit-prompt'
                            placeholder='描述你想如何修订论文图：统一配色、修正标签、清理背景、突出模块或调整布局。'
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            required
                            disabled={isLoading}
                            className='min-h-[80px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    </div>

                    <div className='space-y-2'>
                        <Label className='text-white'>源图像（最多 10 张）</Label>
                        <Label
                            htmlFor='image-files-input'
                            className='flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-white/20 bg-black px-3 py-2 text-sm transition-colors hover:bg-white/5'>
                            <span className='truncate pr-2 text-white/60'>{displayFileNames(imageFiles)}</span>
                            <span className='flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/20'>
                                <Upload className='h-3 w-3' /> 浏览...
                            </span>
                        </Label>
                        <Input
                            id='image-files-input'
                            type='file'
                            accept='image/png, image/jpeg, image/webp'
                            multiple
                            onChange={handleImageFileChange}
                            disabled={isLoading || imageFiles.length >= maxImages}
                            className='sr-only'
                        />
                        {sourceImagePreviewUrls.length > 0 && (
                            <div className='flex space-x-2 overflow-x-auto pt-2'>
                                {sourceImagePreviewUrls.map((url, index) => (
                                    <div key={url} className='relative shrink-0'>
                                        <Image
                                            src={url}
                                            alt={`Source preview ${index + 1}`}
                                            width={80}
                                            height={80}
                                            className='rounded border border-white/10 object-cover'
                                            unoptimized
                                        />
                                        <Button
                                            type='button'
                                            variant='destructive'
                                            size='icon'
                                            className='absolute top-0 right-0 h-5 w-5 translate-x-1/3 -translate-y-1/3 transform rounded-full bg-red-600 p-0.5 text-white hover:bg-red-700'
                                            onClick={() => handleRemoveImage(index)}
                                            aria-label={`Remove image ${index + 1}`}>
                                            <X className='h-3 w-3' />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>遮罩</Label>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => setEditShowMaskEditor(!editShowMaskEditor)}
                            disabled={isLoading || !editOriginalImageSize}
                            className='w-full justify-start border-white/20 px-3 text-white/80 hover:bg-white/10 hover:text-white'>
                            {editShowMaskEditor
                                ? '关闭遮罩编辑器'
                                : editGeneratedMaskFile
                                  ? '编辑已保存遮罩'
                                  : '创建遮罩'}
                            {editIsMaskSaved && !editShowMaskEditor && (
                                <span className='ml-auto text-xs text-green-400'>（已保存）</span>
                            )}
                            <ScanEye className='mt-0.5' />
                        </Button>

                        {editShowMaskEditor && firstImagePreviewUrl && editOriginalImageSize && (
                            <div className='space-y-3 rounded-md border border-white/20 bg-black p-3'>
                                <p className='text-xs text-white/60'>
                                    在图像上涂抹需要局部修订的区域，保存后再提交编辑。
                                </p>
                                <div
                                    className='relative mx-auto w-full overflow-hidden rounded border border-white/10'
                                    style={{
                                        maxWidth: `min(100%, ${editOriginalImageSize.width}px)`,
                                        aspectRatio: `${editOriginalImageSize.width} / ${editOriginalImageSize.height}`
                                    }}>
                                    <Image
                                        src={firstImagePreviewUrl}
                                        alt='Image preview for masking'
                                        width={editOriginalImageSize.width}
                                        height={editOriginalImageSize.height}
                                        className='block h-auto w-full'
                                        unoptimized
                                    />
                                    <canvas
                                        ref={canvasRef}
                                        width={editOriginalImageSize.width}
                                        height={editOriginalImageSize.height}
                                        className='absolute top-0 left-0 h-full w-full cursor-crosshair'
                                        onMouseDown={startDrawing}
                                        onMouseMove={drawLine}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={drawLine}
                                        onTouchEnd={stopDrawing}
                                    />
                                </div>
                                <div className='grid grid-cols-1 gap-4 pt-2'>
                                    <div className='space-y-2'>
                                        <Label htmlFor='brush-size-slider' className='text-sm text-white'>
                                            笔刷大小：{editBrushSize[0]}px
                                        </Label>
                                        <Slider
                                            id='brush-size-slider'
                                            min={5}
                                            max={100}
                                            step={1}
                                            value={editBrushSize}
                                            onValueChange={setEditBrushSize}
                                            disabled={isLoading}
                                            className='mt-1 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                                        />
                                    </div>
                                </div>
                                <div className='flex items-center justify-between gap-2 pt-3'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => maskInputRef.current?.click()}
                                        disabled={isLoading || !editOriginalImageSize}
                                        className='mr-auto border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                                        <UploadCloud className='mr-1.5 h-4 w-4' /> 上传遮罩
                                    </Button>
                                    <Input
                                        ref={maskInputRef}
                                        id='mask-file-input'
                                        type='file'
                                        accept='image/png'
                                        onChange={handleMaskFileChange}
                                        className='sr-only'
                                    />
                                    <div className='flex gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={handleClearMask}
                                            disabled={isLoading}
                                            className='border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                                            <Eraser className='mr-1.5 h-4 w-4' /> 清除
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='default'
                                            size='sm'
                                            onClick={generateAndSaveMask}
                                            disabled={isLoading || editDrawnPoints.length === 0}
                                            className='bg-white text-black hover:bg-white/90 disabled:opacity-50'>
                                            <Save className='mr-1.5 h-4 w-4' /> 保存遮罩
                                        </Button>
                                    </div>
                                </div>
                                {editMaskPreviewUrl && (
                                    <div className='mt-3 border-t border-white/10 pt-3 text-center'>
                                        <Label className='mb-1.5 block text-sm text-white'>
                                            遮罩预览：
                                        </Label>
                                        <div className='inline-block rounded border border-gray-300 bg-white p-1'>
                                            <Image
                                                src={editMaskPreviewUrl}
                                                alt='Generated mask preview'
                                                width={0}
                                                height={134}
                                                className='block max-w-full'
                                                style={{ width: 'auto', height: '134px' }}
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                )}
                                {editIsMaskSaved && !editMaskPreviewUrl && (
                                    <p className='pt-1 text-center text-xs text-yellow-400'>
                                        正在生成遮罩预览...
                                    </p>
                                )}
                                {editIsMaskSaved && editMaskPreviewUrl && (
                                    <p className='pt-1 text-center text-xs text-green-400'>遮罩已保存。</p>
                                )}
                            </div>
                        )}
                        {!editShowMaskEditor && editGeneratedMaskFile && (
                            <p className='pt-1 text-xs text-green-400'>已应用遮罩：{editGeneratedMaskFile.name}</p>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>尺寸</Label>
                        <RadioGroup
                            value={editSize}
                            onValueChange={(value) => setEditSize(value as EditingFormData['size'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='edit-size-auto' label='自动' Icon={Sparkles} />
                            {isGptImage2 && (
                                <RadioItemWithIcon
                                    value='custom'
                                    id='edit-size-custom'
                                    label='自定义'
                                    Icon={SquareDashed}
                                />
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <RadioItemWithIcon
                                            value='square'
                                            id='edit-size-square'
                                            label='正方形'
                                            Icon={Square}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>{getPresetTooltip('square', editModel)}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <RadioItemWithIcon
                                            value='landscape'
                                            id='edit-size-landscape'
                                            label='横向'
                                            Icon={RectangleHorizontal}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>{getPresetTooltip('landscape', editModel)}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <RadioItemWithIcon
                                            value='portrait'
                                            id='edit-size-portrait'
                                            label='纵向'
                                            Icon={RectangleVertical}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>{getPresetTooltip('portrait', editModel)}</TooltipContent>
                            </Tooltip>
                        </RadioGroup>
                        {isGptImage2 && editSize === 'custom' && (
                            <div className='space-y-2 rounded-md border border-white/10 bg-white/5 p-3'>
                                <div className='flex items-center gap-3'>
                                    <div className='flex-1 space-y-1'>
                                        <Label htmlFor='edit-custom-width' className='text-xs text-white/70'>
                                            宽度 (px)
                                        </Label>
                                        <Input
                                            id='edit-custom-width'
                                            type='number'
                                            min={16}
                                            max={3840}
                                            step={16}
                                            value={editCustomWidth}
                                            onChange={(e) => setEditCustomWidth(parseInt(e.target.value, 10) || 0)}
                                            disabled={isLoading}
                                            className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'
                                        />
                                    </div>
                                    <span className='pt-5 text-white/60'>×</span>
                                    <div className='flex-1 space-y-1'>
                                        <Label htmlFor='edit-custom-height' className='text-xs text-white/70'>
                                            高度 (px)
                                        </Label>
                                        <Input
                                            id='edit-custom-height'
                                            type='number'
                                            min={16}
                                            max={3840}
                                            step={16}
                                            value={editCustomHeight}
                                            onChange={(e) => setEditCustomHeight(parseInt(e.target.value, 10) || 0)}
                                            disabled={isLoading}
                                            className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'
                                        />
                                    </div>
                                </div>
                                <p className='text-xs text-white/50'>
                                    {(editCustomWidth * editCustomHeight).toLocaleString()} pixels (
                                    {((editCustomWidth * editCustomHeight) / 8_294_400 * 100).toFixed(1)}% of max) ·{' '}
                                    {editCustomWidth > 0 && editCustomHeight > 0
                                        ? `${(Math.max(editCustomWidth, editCustomHeight) / Math.min(editCustomWidth, editCustomHeight)).toFixed(2)}:1 ratio`
                                        : '—'}
                                </p>
                                {!customSizeValidation.valid && (
                                    <p className='text-xs text-red-400'>{customSizeValidation.reason}</p>
                                )}
                                <p className='text-xs text-white/40'>
                                    Constraints: multiples of 16, max edge 3840px, aspect ratio ≤ 3:1, 655,360 to
                                    8,294,400 total pixels.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>质量</Label>
                        <RadioGroup
                            value={editQuality}
                            onValueChange={(value) => setEditQuality(value as EditingFormData['quality'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='edit-quality-auto' label='自动' Icon={Sparkles} />
                            <RadioItemWithIcon value='low' id='edit-quality-low' label='低' Icon={Tally1} />
                            <RadioItemWithIcon value='medium' id='edit-quality-medium' label='中' Icon={Tally2} />
                            <RadioItemWithIcon value='high' id='edit-quality-high' label='高' Icon={Tally3} />
                        </RadioGroup>
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='edit-n-slider' className='text-white'>
                            图片数量: {editN[0]}
                        </Label>
                        <Slider
                            id='edit-n-slider'
                            min={1}
                            max={10}
                            step={1}
                            value={editN}
                            onValueChange={setEditN}
                            disabled={isLoading}
                            className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                        />
                    </div>
                </CardContent>
                <CardFooter className='border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={isLoading || !editPrompt || imageFiles.length === 0 || customSizeInvalid}
                        className='flex w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
                        {isLoading ? '正在编辑...' : '编辑图片'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
