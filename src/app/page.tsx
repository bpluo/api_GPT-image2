'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { PasswordDialog } from '@/components/password-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { calculateApiCost, type CostDetails, type GptImageModel } from '@/lib/cost-utils';
import { db, deleteStoredImages, putStoredImage, type ImageRecord } from '@/lib/db';
import { getPresetDimensions } from '@/lib/size-utils';
import type { PromptTemplate } from '@/lib/preset-prompts';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

type HistoryImage = {
    filename: string;
};

export type HistoryMetadata = {
    id?: string;
    sessionId?: string;
    parentId?: string;
    sourceImageFilenames?: string[];
    coverImageFilename?: string;
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: 'fs' | 'indexeddb';
    durationMs: number;
    quality: GenerationFormData['quality'];
    background: GenerationFormData['background'];
    moderation: GenerationFormData['moderation'];
    prompt: string;
    mode: 'generate' | 'edit';
    costDetails: CostDetails | null;
    output_format?: GenerationFormData['output_format'];
    model?: GptImageModel;
    presetTitle?: string;
    presetCategory?: string;
    presetTags?: string[];
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

type ImageBatchItem = {
    path: string;
    filename: string;
};

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: string;
    path?: string;
};

type ImageApiResult = {
    images?: ApiImageResponseItem[];
    usage?: Parameters<typeof calculateApiCost>[0];
    error?: string;
};

type DeleteResult = {
    filename: string;
    success: boolean;
    error?: string;
};

const MAX_EDIT_IMAGES = 10;
const HISTORY_STORAGE_KEY = 'openaiImageHistory';
const DELETE_CONFIRM_STORAGE_KEY = 'imageGenSkipDeleteConfirm';

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}

const createHistoryId = (timestamp = Date.now()) => `${timestamp}-${crypto.randomUUID()}`;

const getMimeTypeFromFormat = (format: string): string => {
    if (format === 'jpeg') return 'image/jpeg';
    if (format === 'webp') return 'image/webp';

    return 'image/png';
};

const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

const migrateHistoryItem = (item: HistoryMetadata): HistoryMetadata => {
    const timestamp = Number.isFinite(item.timestamp) ? item.timestamp : Date.now();
    const images = Array.isArray(item.images) ? item.images.filter((img) => img?.filename) : [];
    const id = item.id || `${timestamp}-${images.map((img) => img.filename).join('-') || 'entry'}`;

    return {
        ...item,
        id,
        sessionId: item.sessionId || (item.mode === 'edit' && item.parentId ? item.parentId : id),
        timestamp,
        images,
        storageModeUsed: item.storageModeUsed || 'fs',
        coverImageFilename: item.coverImageFilename || images[0]?.filename,
        sourceImageFilenames: item.sourceImageFilenames || []
    };
};

export default function HomePage() {
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<ImageBatchItem[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const selectedHistoryItemRef = React.useRef<HistoryMetadata | null>(null);
    const pendingEditParentRef = React.useRef<HistoryMetadata | null>(null);
    const selectedPresetRef = React.useRef<PromptTemplate | null>(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [lastApiCallArgs, setLastApiCallArgs] = React.useState<[GenerationFormData | EditingFormData] | null>(null);
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState(false);

    const allDbImages = useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);
    const dbImageMap = React.useMemo(() => new Map((allDbImages ?? []).map((img) => [img.filename, img])), [allDbImages]);

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const [editPrompt, setEditPrompt] = React.useState('');
    const [editN, setEditN] = React.useState([1]);
    const [editSize, setEditSize] = React.useState<EditingFormData['size']>('auto');
    const [editCustomWidth, setEditCustomWidth] = React.useState(1024);
    const [editCustomHeight, setEditCustomHeight] = React.useState(1024);
    const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>('auto');
    const [editBrushSize, setEditBrushSize] = React.useState([20]);
    const [editShowMaskEditor, setEditShowMaskEditor] = React.useState(false);
    const [editGeneratedMaskFile, setEditGeneratedMaskFile] = React.useState<File | null>(null);
    const [editIsMaskSaved, setEditIsMaskSaved] = React.useState(false);
    const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(
        null
    );
    const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
    const [editMaskPreviewUrl, setEditMaskPreviewUrl] = React.useState<string | null>(null);

    const [genModel, setGenModel] = React.useState<GenerationFormData['model']>('gpt-image-2');
    const [genPrompt, setGenPrompt] = React.useState('');
    const [genN, setGenN] = React.useState([1]);
    const [genSize, setGenSize] = React.useState<GenerationFormData['size']>('auto');
    const [genCustomWidth, setGenCustomWidth] = React.useState(1024);
    const [genCustomHeight, setGenCustomHeight] = React.useState(1024);
    const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>('auto');
    const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>('png');
    const [genCompression, setGenCompression] = React.useState([100]);
    const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>('auto');
    const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>('auto');
    const [editModel, setEditModel] = React.useState<EditingFormData['model']>('gpt-image-2');
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);
    const [streamingPreviewImages, setStreamingPreviewImages] = React.useState<Map<number, string>>(new Map());

    const getCachedBlobUrl = React.useCallback((filename: string, blob: Blob) => {
        const cached = blobUrlCacheRef.current.get(filename);
        if (cached) return cached;

        const url = URL.createObjectURL(blob);
        blobUrlCacheRef.current.set(filename, url);
        return url;
    }, []);

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => {
            const cached = blobUrlCacheRef.current.get(filename);
            if (cached) return cached;

            const record = dbImageMap.get(filename);
            return record?.blob ? getCachedBlobUrl(filename, record.blob) : undefined;
        },
        [dbImageMap, getCachedBlobUrl]
    );

    const resolveImageSource = React.useCallback(
        (filename: string, storageMode: 'fs' | 'indexeddb' = effectiveStorageModeClient): string | undefined => {
            return storageMode === 'indexeddb' ? getImageSrc(filename) : `/api/image/${filename}`;
        },
        [getImageSrc]
    );

    React.useEffect(() => {
        const cache = blobUrlCacheRef.current;
        return () => {
            cache.forEach((url) => URL.revokeObjectURL(url));
            cache.clear();
        };
    }, []);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        try {
            const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (storedHistory) {
                const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
                if (Array.isArray(parsedHistory)) {
                    setHistory(parsedHistory.map(migrateHistoryItem));
                } else {
                    console.warn('Invalid history data found in localStorage.');
                    localStorage.removeItem(HISTORY_STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem(HISTORY_STORAGE_KEY);
        }
        setIsInitialLoad(false);
    }, []);

    React.useEffect(() => {
        const fetchAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }
                const data = await response.json();
                setIsPasswordRequiredByBackend(data.passwordRequired);
            } catch (fetchError) {
                console.error('Error fetching auth status:', fetchError);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();
        const storedHash = localStorage.getItem('clientPasswordHash');
        if (storedHash) {
            setClientPasswordHash(storedHash);
        }
    }, []);

    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    React.useEffect(() => {
        const storedPref = localStorage.getItem(DELETE_CONFIRM_STORAGE_KEY);
        if (storedPref === 'true') {
            setSkipDeleteConfirmation(true);
        } else if (storedPref === 'false') {
            setSkipDeleteConfirmation(false);
        }
    }, []);

    React.useEffect(() => {
        localStorage.setItem(DELETE_CONFIRM_STORAGE_KEY, String(skipDeleteConfirmation));
    }, [skipDeleteConfirmation]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (mode !== 'edit' || !event.clipboardData) return;

            if (editImageFiles.length >= MAX_EDIT_IMAGES) {
                alert(`无法粘贴：已附加最多 ${MAX_EDIT_IMAGES} 张图片。`);
                return;
            }

            const items = event.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();
                        setEditImageFiles((prevFiles) => [...prevFiles, file]);
                        setEditSourceImagePreviewUrls((prevUrls) => [...prevUrls, URL.createObjectURL(file)]);
                        pendingEditParentRef.current = null;
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [mode, editImageFiles.length]);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
            setError('密码不能为空。');
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
            if (passwordDialogContext === 'retry' && lastApiCallArgs) {
                await handleApiCall(...lastApiCallArgs);
            }
        } catch (e) {
            console.error('Error hashing password:', e);
            setError('密码保存失败，请重试。');
        }
    };

    const handleOpenPasswordDialog = () => {
        setPasswordDialogContext('initial');
        setIsPasswordDialogOpen(true);
    };

    const buildApiFormData = (formData: GenerationFormData | EditingFormData) => {
        const apiFormData = new FormData();
        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        }
        apiFormData.append('mode', mode);

        if (enableStreaming && mode === 'generate' && genModel === 'gpt-image-2') {
            apiFormData.append('stream', 'true');
            apiFormData.append('partial_images', partialImages.toString());
        }

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            const genSizeToSend =
                genSize === 'custom' ? `${genCustomWidth}x${genCustomHeight}` : (getPresetDimensions(genSize, genModel) ?? genSize);

            apiFormData.append('model', genModel);
            apiFormData.append('prompt', genPrompt);
            apiFormData.append('n', genN[0].toString());
            apiFormData.append('size', genSizeToSend);
            apiFormData.append('quality', genQuality);
            apiFormData.append('output_format', genOutputFormat);
            if ((genOutputFormat === 'jpeg' || genOutputFormat === 'webp') && genData.output_compression !== undefined) {
                apiFormData.append('output_compression', genData.output_compression.toString());
            }
            apiFormData.append('background', genBackground);
            apiFormData.append('moderation', genModeration);
        } else {
            const editSizeToSend =
                editSize === 'custom'
                    ? `${editCustomWidth}x${editCustomHeight}`
                    : (getPresetDimensions(editSize, editModel) ?? editSize);

            apiFormData.append('model', editModel);
            apiFormData.append('prompt', editPrompt);
            apiFormData.append('n', editN[0].toString());
            apiFormData.append('size', editSizeToSend);
            apiFormData.append('quality', editQuality);
            editImageFiles.forEach((file, index) => apiFormData.append(`image_${index}`, file, file.name));
            if (editGeneratedMaskFile) {
                apiFormData.append('mask', editGeneratedMaskFile, editGeneratedMaskFile.name);
            }
        }

        return apiFormData;
    };

    const persistApiImages = React.useCallback(
        async (images: ApiImageResponseItem[]) => {
            const imagePromises = images.map(async (img) => {
                if (effectiveStorageModeClient === 'indexeddb') {
                    if (!img.b64_json) {
                        console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                        return null;
                    }

                    const blob = base64ToBlob(img.b64_json, getMimeTypeFromFormat(img.output_format));
                    await putStoredImage({ filename: img.filename, blob });
                    return { filename: img.filename, path: getCachedBlobUrl(img.filename, blob) };
                }

                return img.path ? { filename: img.filename, path: img.path } : null;
            });

            return (await Promise.all(imagePromises)).filter(Boolean) as ImageBatchItem[];
        },
        [getCachedBlobUrl]
    );

    const createHistoryEntry = React.useCallback(
        (images: ApiImageResponseItem[], usage: ImageApiResult['usage'], durationMs: number): HistoryMetadata => {
            const batchTimestamp = Date.now();
            const id = createHistoryId(batchTimestamp);
            const currentModel = mode === 'generate' ? genModel : editModel;
            const parent = mode === 'edit' ? pendingEditParentRef.current : null;
            const parentId = parent?.id;
            const sessionId = mode === 'edit' ? (parent?.sessionId ?? parent?.id ?? id) : id;
            const sourceImageFilenames = mode === 'edit' ? editImageFiles.map((file) => file.name) : [];

            return {
                id,
                sessionId,
                parentId,
                sourceImageFilenames,
                timestamp: batchTimestamp,
                images: images.map((img) => ({ filename: img.filename })),
                storageModeUsed: effectiveStorageModeClient,
                durationMs,
                quality: mode === 'generate' ? genQuality : editQuality,
                background: mode === 'generate' ? genBackground : 'auto',
                moderation: mode === 'generate' ? genModeration : 'auto',
                output_format: mode === 'generate' ? genOutputFormat : 'png',
                prompt: mode === 'generate' ? genPrompt : editPrompt,
                mode,
                costDetails: calculateApiCost(usage, currentModel),
                model: currentModel,
                presetTitle: selectedPresetRef.current?.title,
                presetCategory: selectedPresetRef.current ? '科研论文绘图' : undefined,
                presetTags: selectedPresetRef.current?.tags,
                coverImageFilename: images[0]?.filename
            };
        },
        [editImageFiles, editModel, editPrompt, editQuality, genBackground, genModel, genModeration, genOutputFormat, genPrompt, genQuality, mode]
    );

    const finalizeImages = React.useCallback(
        async (images: ApiImageResponseItem[], usage: ImageApiResult['usage'], durationMs: number) => {
            const processedImages = await persistApiImages(images);
            if (processedImages.length === 0) {
                throw new Error('API 返回了图片数据，但未能保存或读取图片。');
            }

            const newHistoryEntry = createHistoryEntry(images, usage, durationMs);
            setLatestImageBatch(processedImages);
            setImageOutputView(processedImages.length > 1 ? 'grid' : 0);
            setStreamingPreviewImages(new Map());
            setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
            selectedHistoryItemRef.current = newHistoryEntry;
            pendingEditParentRef.current = null;
        },
        [createHistoryEntry, persistApiImages]
    );

    const consumeStream = React.useCallback(
        async (response: Response, startTime: number) => {
            if (!response.body) {
                throw new Error('流式响应为空。');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    const event = JSON.parse(line.slice(6));
                    if (event.type === 'partial_image') {
                        const imageIndex = event.index ?? 0;
                        const dataUrl = `data:image/png;base64,${event.b64_json}`;
                        setStreamingPreviewImages((prev) => {
                            const newMap = new Map(prev);
                            newMap.set(imageIndex, dataUrl);
                            return newMap;
                        });
                    } else if (event.type === 'error') {
                        throw new Error(event.error || '流式生成失败。');
                    } else if (event.type === 'done') {
                        if (event.images?.length) {
                            await finalizeImages(event.images, event.usage, Date.now() - startTime);
                        }
                    }
                }
            }
        },
        [finalizeImages]
    );

    const handleApiCall = async (formData: GenerationFormData | EditingFormData) => {
        const startTime = Date.now();

        if (isPasswordRequiredByBackend && !clientPasswordHash) {
            setError('需要密码。请点击锁形图标配置密码。');
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            return;
        }

        setIsLoading(true);
        setError(null);
        setLatestImageBatch(null);
        setImageOutputView('grid');
        setStreamingPreviewImages(new Map());

        try {
            const response = await fetch('/api/images', {
                method: 'POST',
                body: buildApiFormData(formData)
            });

            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/event-stream')) {
                await consumeStream(response, startTime);
                return;
            }

            const result = (await response.json()) as ImageApiResult;
            if (!response.ok) {
                if (response.status === 401 && isPasswordRequiredByBackend) {
                    setError('未授权：密码不正确或缺失，请重试。');
                    setPasswordDialogContext('retry');
                    setLastApiCallArgs([formData]);
                    setIsPasswordDialogOpen(true);
                    return;
                }
                throw new Error(result.error || `API 请求失败，状态码 ${response.status}`);
            }

            if (!result.images?.length) {
                throw new Error('API 响应中没有有效的图片数据。');
            }

            await finalizeImages(result.images, result.usage, Date.now() - startTime);
        } catch (err: unknown) {
            const durationMs = Date.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            setError(err instanceof Error ? err.message : '发生未知错误。');
            setLatestImageBatch(null);
            setStreamingPreviewImages(new Map());
        } finally {
            setIsLoading(false);
        }
    };

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata) => {
            const storageMode = item.storageModeUsed || 'fs';
            const selectedBatch = item.images
                .map((imgInfo) => {
                    const path = resolveImageSource(imgInfo.filename, storageMode);
                    if (!path) {
                        console.warn(`Could not get image source for history item: ${imgInfo.filename}`);
                        return null;
                    }
                    return { path, filename: imgInfo.filename };
                })
                .filter(Boolean) as ImageBatchItem[];

            if (selectedBatch.length !== item.images.length) {
                setError('部分历史图片无法加载，可能已被清理或移动。');
            } else {
                setError(null);
            }

            selectedHistoryItemRef.current = item;
            setLatestImageBatch(selectedBatch.length > 0 ? selectedBatch : null);
            setImageOutputView(selectedBatch.length > 1 ? 'grid' : 0);
        },
        [resolveImageSource]
    );

    const handleClearHistory = React.useCallback(async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? '确定要清空全部历史记录吗？当前使用 IndexedDB 存储，本地图片也会被永久删除。此操作不可撤销。'
                : '确定要清空全部历史记录吗？此操作不可撤销。';

        if (!window.confirm(confirmationMessage)) return;

        setHistory([]);
        setLatestImageBatch(null);
        setImageOutputView('grid');
        setError(null);
        selectedHistoryItemRef.current = null;
        pendingEditParentRef.current = null;

        try {
            localStorage.removeItem(HISTORY_STORAGE_KEY);

            if (effectiveStorageModeClient === 'indexeddb') {
                await db.images.clear();
                blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                blobUrlCacheRef.current.clear();
            }
        } catch (e) {
            console.error('Failed during history clearing:', e);
            setError(`清空历史失败：${e instanceof Error ? e.message : String(e)}`);
        }
    }, []);

    const handleSendToEdit = async (filename: string) => {
        if (isSendingToEdit) return;
        setIsSendingToEdit(true);
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (mode === 'edit' && alreadyExists) {
            setIsSendingToEdit(false);
            return;
        }

        if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
            setError(`最多只能添加 ${MAX_EDIT_IMAGES} 张图片到编辑表单。`);
            setIsSendingToEdit(false);
            return;
        }

        try {
            let blob: Blob | undefined;
            let mimeType = 'image/png';

            if (effectiveStorageModeClient === 'indexeddb') {
                const record = dbImageMap.get(filename);
                if (record?.blob) {
                    blob = record.blob;
                    mimeType = blob.type || mimeType;
                } else {
                    throw new Error(`本地数据库中找不到图片 ${filename}。`);
                }
            } else {
                const response = await fetch(`/api/image/${filename}`);
                if (!response.ok) {
                    throw new Error(`图片读取失败：${response.statusText}`);
                }
                blob = await response.blob();
                mimeType = response.headers.get('Content-Type') || mimeType;
            }

            const newFile = new File([blob], filename, { type: mimeType });
            const newPreviewUrl = URL.createObjectURL(blob);
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
            setEditImageFiles([newFile]);
            setEditSourceImagePreviewUrls([newPreviewUrl]);
            pendingEditParentRef.current = selectedHistoryItemRef.current;

            if (mode === 'generate') {
                setMode('edit');
            }
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            setError(err instanceof Error ? err.message : '发送到编辑表单失败。');
        } finally {
            setIsSendingToEdit(false);
        }
    };

    const executeDeleteItem = React.useCallback(
        async (item: HistoryMetadata) => {
            setError(null);
            const { images: imagesInEntry, timestamp } = item;
            const storageModeUsed = item.storageModeUsed || 'fs';
            const filenamesToDelete = imagesInEntry.map((img) => img.filename);

            try {
                let failedDeletes: DeleteResult[] = [];

                if (storageModeUsed === 'indexeddb') {
                    await deleteStoredImages(filenamesToDelete);
                    filenamesToDelete.forEach((fn) => {
                        const url = blobUrlCacheRef.current.get(fn);
                        if (url) URL.revokeObjectURL(url);
                        blobUrlCacheRef.current.delete(fn);
                    });
                } else {
                    const apiPayload: { filenames: string[]; passwordHash?: string } = { filenames: filenamesToDelete };
                    if (isPasswordRequiredByBackend && clientPasswordHash) {
                        apiPayload.passwordHash = clientPasswordHash;
                    }

                    const response = await fetch('/api/image-delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(apiPayload)
                    });

                    const result = (await response.json()) as { error?: string; results?: DeleteResult[] };
                    if (!response.ok && response.status !== 207) {
                        throw new Error(result.error || `删除失败，状态码 ${response.status}`);
                    }
                    failedDeletes = result.results?.filter((r) => !r.success) ?? [];
                }

                setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
                setLatestImageBatch((prev) =>
                    prev && prev.some((img) => filenamesToDelete.includes(img.filename)) ? null : prev
                );
                if (selectedHistoryItemRef.current?.timestamp === timestamp) {
                    selectedHistoryItemRef.current = null;
                }
                if (failedDeletes.length > 0) {
                    setError(`历史记录已移除，但 ${failedDeletes.length} 个文件未能从磁盘删除。`);
                }
            } catch (e: unknown) {
                console.error('Error during item deletion:', e);
                setError(e instanceof Error ? e.message : '删除历史记录时发生未知错误。');
            } finally {
                setItemToDeleteConfirm(null);
            }
        },
        [clientPasswordHash, isPasswordRequiredByBackend]
    );

    const handleRequestDeleteItem = React.useCallback(
        (item: HistoryMetadata) => {
            if (!skipDeleteConfirmation) {
                setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
                setItemToDeleteConfirm(item);
            } else {
                executeDeleteItem(item);
            }
        },
        [executeDeleteItem, skipDeleteConfirmation]
    );

    const handleConfirmDeletion = React.useCallback(() => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm);
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    }, [dialogCheckboxStateSkipConfirm, executeDeleteItem, itemToDeleteConfirm]);

    const handleCancelDeletion = React.useCallback(() => {
        setItemToDeleteConfirm(null);
    }, []);

    return (
        <main className='min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.12),transparent_28%)] bg-background p-3 text-foreground md:p-4 lg:p-6'>
            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
                onSave={handleSavePassword}
                title={passwordDialogContext === 'retry' ? '需要密码' : '配置密码'}
                description={
                    passwordDialogContext === 'retry'
                        ? '服务器需要密码，或之前输入的密码不正确。请重新输入。'
                        : '设置用于 API 请求的密码。'
                }
            />
            <div className='mx-auto flex w-full max-w-[1500px] flex-col gap-5'>
                <header className='flex flex-col gap-3 rounded-3xl border border-border/70 bg-card/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:flex-row md:items-end md:justify-between'>
                    <div className='space-y-2'>
                        <p className='text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground'>AI Image Console</p>
                        <div>
                            <h1 className='text-2xl font-semibold tracking-tight md:text-4xl'>图像生成工作台</h1>
                            <p className='mt-2 max-w-2xl text-sm text-muted-foreground'>输入提示词、管理编辑素材，并在历史链路中回看每一次创作。</p>
                        </div>
                    </div>
                    <div className='grid grid-cols-3 gap-2 text-right text-xs text-muted-foreground md:min-w-[280px]'>
                        <div className='rounded-2xl border border-border/70 bg-background/45 p-3'>
                            <div className='text-lg font-semibold text-foreground'>{history.length}</div>
                            <div>记录</div>
                        </div>
                        <div className='rounded-2xl border border-border/70 bg-background/45 p-3'>
                            <div className='text-lg font-semibold text-foreground'>{history.reduce((sum, item) => sum + item.images.length, 0)}</div>
                            <div>图片</div>
                        </div>
                        <div className='rounded-2xl border border-border/70 bg-background/45 p-3'>
                            <div className='text-lg font-semibold text-foreground'>{effectiveStorageModeClient}</div>
                            <div>存储</div>
                        </div>
                    </div>
                </header>

                <section className='grid min-h-[62vh] grid-cols-1 gap-4 lg:grid-cols-[minmax(420px,0.92fr)_minmax(520px,1.08fr)] lg:gap-5'>
                    <div className='relative flex h-[62vh] min-h-[520px] flex-col'>
                        <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                            <GenerationForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                model={genModel}
                                setModel={setGenModel}
                                prompt={genPrompt}
                                setPrompt={setGenPrompt}
                                n={genN}
                                setN={setGenN}
                                size={genSize}
                                setSize={setGenSize}
                                customWidth={genCustomWidth}
                                setCustomWidth={setGenCustomWidth}
                                customHeight={genCustomHeight}
                                setCustomHeight={setGenCustomHeight}
                                quality={genQuality}
                                setQuality={setGenQuality}
                                outputFormat={genOutputFormat}
                                setOutputFormat={setGenOutputFormat}
                                compression={genCompression}
                                setCompression={setGenCompression}
                                background={genBackground}
                                setBackground={setGenBackground}
                                moderation={genModeration}
                                setModeration={setGenModeration}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                                onPresetSelect={(preset) => {
                                    selectedPresetRef.current = preset;
                                }}
                            />
                        </div>
                        <div className={mode === 'edit' ? 'block h-full w-full' : 'hidden'}>
                            <EditingForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading || isSendingToEdit}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                editModel={editModel}
                                setEditModel={setEditModel}
                                imageFiles={editImageFiles}
                                sourceImagePreviewUrls={editSourceImagePreviewUrls}
                                setImageFiles={(value) => {
                                    pendingEditParentRef.current = null;
                                    setEditImageFiles(value);
                                }}
                                setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                                maxImages={MAX_EDIT_IMAGES}
                                editPrompt={editPrompt}
                                setEditPrompt={setEditPrompt}
                                editN={editN}
                                setEditN={setEditN}
                                editSize={editSize}
                                setEditSize={setEditSize}
                                editCustomWidth={editCustomWidth}
                                setEditCustomWidth={setEditCustomWidth}
                                editCustomHeight={editCustomHeight}
                                setEditCustomHeight={setEditCustomHeight}
                                editQuality={editQuality}
                                setEditQuality={setEditQuality}
                                editBrushSize={editBrushSize}
                                setEditBrushSize={setEditBrushSize}
                                editShowMaskEditor={editShowMaskEditor}
                                setEditShowMaskEditor={setEditShowMaskEditor}
                                editGeneratedMaskFile={editGeneratedMaskFile}
                                setEditGeneratedMaskFile={setEditGeneratedMaskFile}
                                editIsMaskSaved={editIsMaskSaved}
                                setEditIsMaskSaved={setEditIsMaskSaved}
                                editOriginalImageSize={editOriginalImageSize}
                                setEditOriginalImageSize={setEditOriginalImageSize}
                                editDrawnPoints={editDrawnPoints}
                                setEditDrawnPoints={setEditDrawnPoints}
                                editMaskPreviewUrl={editMaskPreviewUrl}
                                setEditMaskPreviewUrl={setEditMaskPreviewUrl}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                                onPresetSelect={(preset) => {
                                    selectedPresetRef.current = preset;
                                }}
                            />
                        </div>
                    </div>
                    <div className='flex h-[62vh] min-h-[520px] flex-col'>
                        {error && (
                            <Alert variant='destructive' className='mb-3 border-destructive/40 bg-destructive/10 text-destructive'>
                                <AlertTitle>提示</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ImageOutput
                            imageBatch={latestImageBatch}
                            viewMode={imageOutputView}
                            onViewChange={setImageOutputView}
                            altText='生成的图片输出'
                            isLoading={isLoading || isSendingToEdit}
                            onSendToEdit={handleSendToEdit}
                            currentMode={mode}
                            baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                            streamingPreviewImages={streamingPreviewImages}
                        />
                    </div>
                </section>

                <section className='min-h-[240px]'>
                    <HistoryPanel
                        history={history}
                        onSelectImage={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getImageSrc={getImageSrc}
                        onDeleteItemRequest={handleRequestDeleteItem}
                        itemPendingDeleteConfirmation={itemToDeleteConfirm}
                        onConfirmDeletion={handleConfirmDeletion}
                        onCancelDeletion={handleCancelDeletion}
                        deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                        onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                    />
                </section>
            </div>
        </main>
    );
}
