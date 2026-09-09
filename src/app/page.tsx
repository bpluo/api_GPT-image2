'use client';

import { ApiSettingsDialog } from '@/components/api-settings-dialog';
import { EditingForm } from '@/components/editing-form';
import { GenerationForm } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { ModeToggle } from '@/components/mode-toggle';
import { PasswordDialog } from '@/components/password-dialog';
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
import { useHistoryStore } from '@/hooks/use-history-store';
import { useImageJob } from '@/hooks/use-image-job';
import { useWorkspaceDraft } from '@/hooks/use-workspace-draft';
import {
    activeProfile,
    fetchModelList,
    hostLabel,
    loadProfileStore,
    profileCredentials as profileCredentialsOf,
    saveProfileStore,
    type ApiProfile
} from '@/lib/api-profiles';
import { deleteHistoryFiles, loadHistoryImages, persistImageResult, type DisplayImage } from '@/lib/client-images';
import { calculateApiCost } from '@/lib/cost-utils';
import { applyHistoryDeletion, type HistoryMetadata } from '@/lib/history';
import type { ApiCredentials, ImageRequest } from '@/lib/image-request';
import { normalizeImageSettings, selectImageFiles, type ImageMode, type StorageMode } from '@/lib/image-settings';
import type { PromptTemplate } from '@/lib/preset-prompts';
import {
    AlertCircle,
    ArrowDown,
    CheckCircle2,
    CircleHelp,
    KeyRound,
    Loader2,
    LockKeyhole,
    Palette,
    RotateCcw,
    Settings2,
    X
} from 'lucide-react';
import * as React from 'react';

export type { HistoryMetadata } from '@/lib/history';

type AuthStatus = { passwordRequired: boolean; hasServerKey: boolean; storageMode: StorageMode };
type WorkRequest = ImageRequest & { parent?: HistoryMetadata | null; preset?: PromptTemplate | null };
type PendingAction = { type: 'request'; request: WorkRequest } | { type: 'delete'; items: HistoryMetadata[] };

export default function HomePage() {
    const { draft, ready: draftReady, update: updateDraft, setMode, storageError: draftError } = useWorkspaceDraft();
    const historyStore = useHistoryStore();
    const job = useImageJob();
    const [auth, setAuth] = React.useState<AuthStatus | null>(null);
    const [authError, setAuthError] = React.useState(false);
    const [settingsReady, setSettingsReady] = React.useState(false);
    const [profileStore, setProfileStore] = React.useState<{
        version: 1;
        profiles: ApiProfile[];
        activeId: string | null;
    }>({ version: 1, profiles: [], activeId: null });
    const [profileStorageError, setProfileStorageError] = React.useState(false);
    const [availableModels, setAvailableModels] = React.useState<string[]>([]);
    const [modelsLoading, setModelsLoading] = React.useState(false);
    const [modelStatus, setModelStatus] = React.useState<{ loading: boolean; models: string[]; error: string | null } | null>(
        null
    );
    const [passwordHash, setPasswordHash] = React.useState<string | null>(null);
    const [apiOpen, setApiOpen] = React.useState(false);
    const [passwordOpen, setPasswordOpen] = React.useState(false);
    const [passwordRetry, setPasswordRetry] = React.useState(false);
    const [notice, setNotice] = React.useState<string | null>(null);
    const [actionError, setActionError] = React.useState<string | null>(null);
    const [files, setFiles] = React.useState<File[]>([]);
    const [editParent, setEditParent] = React.useState<HistoryMetadata | null>(null);
    const [images, setImages] = React.useState<DisplayImage[]>([]);
    const [selected, setSelected] = React.useState<HistoryMetadata | null>(null);
    const [view, setView] = React.useState<'grid' | number>('grid');
    const [working, setWorking] = React.useState(false);
    const [deleteTargets, setDeleteTargets] = React.useState<HistoryMetadata[] | null>(null);
    const [skipConfirmation, setSkipConfirmation] = React.useState(false);
    const [confirmSkip, setConfirmSkip] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const pending = React.useRef<PendingAction | null>(null);
    const lastRequest = React.useRef<WorkRequest | null>(null);
    const presets = React.useRef<Record<ImageMode, PromptTemplate | null>>({ generate: null, edit: null });
    const activityLock = React.useRef(false);
    const initialPreviewLoaded = React.useRef(false);
    const blobUrls = React.useRef(new Set<string>());
    const busy = job.isRunning || working || isDeleting;
    const ready = draftReady && historyStore.ready && settingsReady && !!auth;

    const fetchAuth = React.useCallback(async () => {
        setAuthError(false);
        try {
            const response = await fetch('/api/auth-status', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
            if (!response.ok) throw new Error('配置读取失败');
            const result = await response.json();
            if (typeof result.passwordRequired !== 'boolean' || typeof result.hasServerKey !== 'boolean')
                throw new Error('配置格式无效');
            setAuth({
                passwordRequired: result.passwordRequired,
                hasServerKey: result.hasServerKey,
                storageMode: result.storageMode === 'indexeddb' ? 'indexeddb' : 'fs'
            });
        } catch {
            setAuthError(true);
        }
    }, []);
    React.useEffect(() => {
        void fetchAuth();
    }, [fetchAuth]);
    React.useEffect(() => {
        try {
            const store = loadProfileStore();
            setProfileStore(store);
            if (!store.profiles.length && localStorage.getItem('apiSettings')) setProfileStorageError(true);
            setPasswordHash(localStorage.getItem('clientPasswordHash'));
            setSkipConfirmation(localStorage.getItem('imageGenSkipDeleteConfirm') === 'true');
        } catch {
            setNotice('浏览器中的设置未能读取。可以重新配置后继续使用。');
        }
        setSettingsReady(true);
    }, []);
    React.useEffect(() => {
        const next = new Set(images.filter((image) => image.path.startsWith('blob:')).map((image) => image.path));
        blobUrls.current.forEach((url) => {
            if (!next.has(url)) URL.revokeObjectURL(url);
        });
        blobUrls.current = next;
    }, [images]);
    React.useEffect(
        () => () => {
            blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
        },
        []
    );
    React.useEffect(() => {
        if (!job.isRunning) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [job.isRunning]);

    const focusComposer = (mode: ImageMode = draft.mode) => {
        document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.requestAnimationFrame(() => document.getElementById(`${mode}-prompt`)?.focus({ preventScroll: true }));
    };
    const showResults = () =>
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const profileCredentials = React.useMemo(() => profileCredentialsOf(profileStore), [profileStore]);
    const credentials = (override?: ApiCredentials): ApiCredentials => ({
        ...profileCredentials,
        passwordHash,
        ...override
    });
    const apiLabel = (() => {
        const profile = activeProfile(profileStore);
        if (!auth) return authError ? '连接异常' : '检查配置中';
        if (profile) return profile.name || hostLabel(profile.baseUrl);
        return auth.hasServerKey ? '服务端已配置' : '设置 API 后开始';
    })();

    const runRequest = async (request: WorkRequest, override?: ApiCredentials) => {
        if (job.isRunning || activityLock.current) return;
        if (!auth) {
            setActionError('工作台尚未连接，请先点击“重新连接”。');
            return;
        }
        const currentCredentials = credentials(override);
        lastRequest.current = request;
        if (auth.passwordRequired && !currentCredentials.passwordHash) {
            pending.current = { type: 'request', request };
            setPasswordRetry(false);
            setPasswordOpen(true);
            return;
        }
        if (!currentCredentials.apiKey && !auth.hasServerKey) {
            pending.current = { type: 'request', request };
            setApiOpen(true);
            return;
        }
        setMode(request.mode);
        setActionError(null);
        setNotice(null);
        if (window.matchMedia('(max-width: 1023px)').matches) showResults();
        const failure = await job.run(request, currentCredentials, async (result, durationMs) => {
            const storageMode = result.storageMode || auth.storageMode;
            const persisted = await persistImageResult(result, storageMode);
            const settings = request.settings;
            const id = `${Date.now()}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
            const entry: HistoryMetadata = {
                id,
                sessionId: request.parent?.sessionId || request.parent?.id || id,
                parentId: request.parent?.id,
                timestamp: Date.now(),
                images: result.images.map((image) => ({ filename: image.filename })),
                storageModeUsed: storageMode,
                durationMs,
                mode: request.mode,
                prompt: settings.prompt.trim(),
                quality: settings.quality,
                background: settings.background,
                moderation: settings.moderation,
                model: settings.model,
                output_format: request.mode === 'edit' ? 'png' : settings.output_format,
                settings: { ...settings },
                costDetails: calculateApiCost(result.usage, settings.model),
                sourceImageFilenames: request.imageFiles?.map((file) => file.name),
                coverImageFilename: result.images[0].filename,
                presetTitle: request.preset?.title,
                presetId: request.preset?.id,
                presetCategory: request.preset?.categoryLabel,
                presetTags: request.preset?.tags
            };
            setImages(persisted.images);
            setSelected(entry);
            setView(persisted.images.length > 1 ? 'grid' : 0);
            if (result.warning) setNotice(result.warning);
            if (persisted.saved) historyStore.update((items) => [entry, ...items.filter((item) => item.id !== id)]);
            else
                setActionError(
                    '图片已生成，但浏览器空间不足或存储不可用，未能保存到历史。请先下载原图，避免刷新后丢失。'
                );
        });
        if (failure?.code === 'APP_PASSWORD_REQUIRED' || failure?.code === 'APP_PASSWORD_INVALID') {
            pending.current = { type: 'request', request };
            setPasswordRetry(true);
            setPasswordOpen(true);
        } else if (failure?.code === 'API_CONFIG_ERROR') {
            pending.current = { type: 'request', request };
            setApiOpen(true);
        }
    };
    const submit = (request: ImageRequest) =>
        void runRequest({
            ...request,
            settings: { ...request.settings },
            imageFiles: request.imageFiles ? [...request.imageFiles] : undefined,
            parent: request.mode === 'edit' ? editParent : null,
            preset: presets.current[request.mode]
        });

    const selectHistory = React.useCallback(async (item: HistoryMetadata, scroll = true) => {
        if (activityLock.current) return;
        activityLock.current = true;
        setWorking(true);
        setActionError(null);
        try {
            const batch = await loadHistoryImages(item);
            setImages(batch);
            setSelected(item);
            setView(batch.length > 1 ? 'grid' : 0);
            if (batch.length !== item.images.length)
                setActionError('部分图片无法读取，可能已被清理或来自另一台设备。提示词和参数仍可复用。');
            if (scroll) document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
            setActionError('历史图片读取失败，请检查浏览器存储权限。');
        } finally {
            activityLock.current = false;
            setWorking(false);
        }
    }, []);
    React.useEffect(() => {
        if (!historyStore.ready || initialPreviewLoaded.current) return;
        initialPreviewLoaded.current = true;
        if (historyStore.history[0]) void selectHistory(historyStore.history[0], false);
    }, [historyStore.ready, historyStore.history, selectHistory]);

    const addFiles = React.useCallback(
        (incoming: File[]) => {
            const result = selectImageFiles(files, incoming);
            if (result.accepted.length) {
                setFiles([...files, ...result.accepted]);
                if (!files.length) setEditParent(null);
            }
            setActionError(result.message || null);
        },
        [files]
    );
    const changeFiles = (next: File[]) => {
        if (files[0] !== next[0]) setEditParent(null);
        setFiles(next);
        setActionError(null);
    };
    const sendToEdit = async (image: DisplayImage) => {
        if (busy || activityLock.current) return;
        activityLock.current = true;
        setWorking(true);
        setActionError(null);
        try {
            const response = await fetch(image.path, { signal: AbortSignal.timeout(30000) });
            if (!response.ok) throw new Error('图片读取失败，请确认文件仍然存在。');
            const blob = await response.blob();
            const file = new File([blob], image.filename, { type: blob.type || 'image/png' });
            const result = selectImageFiles([], [file]);
            if (!result.accepted.length) throw new Error(result.message);
            setFiles([file]);
            setEditParent(selected);
            setMode('edit');
            if (selected?.model) updateDraft('edit', { model: selected.model });
            setNotice('已将作品设为新的编辑底图，填写修改描述即可继续创作。');
            focusComposer('edit');
        } catch (cause) {
            setActionError(cause instanceof Error ? cause.message : '无法载入编辑底图。');
        } finally {
            activityLock.current = false;
            setWorking(false);
        }
    };
    const restoreHistory = (item: HistoryMetadata) => {
        if (busy) return;
        const settings =
            item.settings ||
            normalizeImageSettings({
                prompt: item.prompt,
                model: item.model,
                quality: item.quality,
                output_format: item.output_format,
                background: item.background,
                moderation: item.moderation,
                n: item.images.length
            });
        updateDraft(item.mode, { ...settings, prompt: item.prompt });
        setMode(item.mode);
        presets.current[item.mode] = null;
        setNotice(
            item.mode === 'edit'
                ? '已复用提示词和参数，请确认当前底图与参考图，再提交编辑。'
                : item.settings
                  ? '已复用提示词和参数，可调整后重新生成。'
                  : '已复用旧记录中的参数；未记录的尺寸使用自动设置。'
        );
        focusComposer(item.mode);
    };

    const executeDeletion = async (targets: HistoryMetadata[], override?: ApiCredentials) => {
        if (activityLock.current || job.isRunning) return;
        const currentCredentials = credentials(override);
        if (
            targets.some((item) => item.storageModeUsed === 'fs') &&
            auth?.passwordRequired &&
            !currentCredentials.passwordHash
        ) {
            pending.current = { type: 'delete', items: targets };
            setDeleteTargets(null);
            setPasswordRetry(false);
            setPasswordOpen(true);
            return;
        }
        activityLock.current = true;
        setIsDeleting(true);
        setActionError(null);
        try {
            const ids = new Set(targets.map((item) => item.id));
            const result = await deleteHistoryFiles(historyStore.readCurrent(), ids, currentCredentials.passwordHash);
            const next = historyStore.update((items) => applyHistoryDeletion(items, ids, result.removed));
            if (selected && ids.has(selected.id)) {
                const remaining = next.find((item) => item.id === selected.id) || null;
                setSelected(remaining);
                setImages((current) =>
                    remaining
                        ? current.filter((image) => remaining.images.some((saved) => saved.filename === image.filename))
                        : []
                );
                setView('grid');
            }
            if (editParent && !next.some((item) => item.id === editParent.id)) setEditParent(null);
            if (result.error) {
                setActionError(result.error.message);
                if (result.error.code === 'APP_PASSWORD_REQUIRED' || result.error.code === 'APP_PASSWORD_INVALID') {
                    pending.current = { type: 'delete', items: targets };
                    setPasswordRetry(true);
                    setPasswordOpen(true);
                }
            } else setNotice('所选历史已删除。其他记录仍在使用的图片会保留。');
        } finally {
            activityLock.current = false;
            setIsDeleting(false);
            setDeleteTargets(null);
        }
    };
    const askDelete = (targets: HistoryMetadata[]) => {
        if (busy) return;
        if (targets.length === 1 && skipConfirmation) void executeDeletion(targets);
        else {
            setConfirmSkip(skipConfirmation);
            setDeleteTargets(targets);
        }
    };
    const resumePending = (override: ApiCredentials) => {
        const action = pending.current;
        pending.current = null;
        if (action?.type === 'request') void runRequest(action.request, override);
        else if (action?.type === 'delete') void executeDeletion(action.items, override);
    };
    const saveProfileStoreState = (profiles: ApiProfile[], activeId: string | null) => {
        const next = { version: 1 as const, activeId, profiles };
        setProfileStore(next);
        const persisted = saveProfileStore(next);
        if (!persisted) setNotice('配置已用于当前页面，但浏览器未能保存，刷新后需重新填写。');
        // 与旧版单配置行为一致：保存后自动继续刚才因缺少密钥而挂起的操作。
        if (activeId && profiles.some((profile) => profile.id === activeId))
            resumePending(profileCredentialsOf(next));
    };
    const testModels = async (profile: Pick<ApiProfile, 'apiKey' | 'baseUrl'>) => {
        setModelStatus({ loading: true, models: [], error: null });
        try {
            const models = await fetchModelList({ apiKey: profile.apiKey, baseUrl: profile.baseUrl });
            setModelStatus({ loading: false, models, error: null });
            return models;
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : '模型列表获取失败，请重试。';
            setModelStatus({ loading: false, models: [], error: message });
            throw cause;
        }
    };
    const fetchingModels = React.useRef(false);
    const fetchedModelsKey = React.useRef<string | null>(null);
    const refreshModels = React.useCallback(async () => {
        if (fetchingModels.current) return;
        const creds = profileCredentialsOf(profileStore);
        if (!creds.apiKey && !auth?.hasServerKey) {
            setActionError('请先在 API 设置中添加配置，再获取模型列表。');
            setApiOpen(true);
            return;
        }
        fetchingModels.current = true;
        setModelsLoading(true);
        try {
            const models = await fetchModelList(creds);
            setAvailableModels(models);
        } catch {
            setAvailableModels([]);
        } finally {
            fetchingModels.current = false;
            setModelsLoading(false);
        }
    }, [profileStore, auth]);
    // 自动获取一次模型列表：按凭据指纹去重，避免失败后无限重试。
    React.useEffect(() => {
        if (!ready) return;
        const creds = profileCredentialsOf(profileStore);
        const key = creds.apiKey ? `${creds.baseUrl}|${creds.apiKey.slice(-8)}` : auth?.hasServerKey ? 'server' : null;
        if (!key || fetchedModelsKey.current === key) return;
        fetchedModelsKey.current = key;
        void refreshModels();
    }, [ready, profileStore, auth, refreshModels]);
    const savePassword = async (password: string) => {
        if (!globalThis.crypto?.subtle)
            throw new Error('当前浏览器无法验证密码，请通过 HTTPS 或 localhost 访问工作台。');
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
        setPasswordHash(hash);
        setPasswordOpen(false);
        try {
            localStorage.setItem('clientPasswordHash', hash);
        } catch {
            setNotice('密码仅在当前页面有效，刷新后需重新输入。');
        }
        resumePending({ passwordHash: hash });
    };

    const errorText = actionError || job.error?.message;
    const storageWarning =
        historyStore.storageError ||
        draftError ||
        (profileStorageError ? '浏览器中的旧版 API 设置未能迁移，请重新添加配置。' : null);
    React.useEffect(() => {
        if (errorText && !apiOpen && !passwordOpen && window.matchMedia('(max-width: 1023px)').matches) {
            const alert = document.getElementById('workspace-error');
            alert?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            alert?.focus({ preventScroll: true });
        }
    }, [errorText, apiOpen, passwordOpen]);
    return (
        <main className='bg-background text-foreground min-h-dvh p-3 sm:p-5 lg:p-6'>
            <div className='mx-auto flex w-full max-w-[1480px] flex-col gap-5'>
                <header className='flex flex-wrap items-center justify-between gap-4'>
                    <div className='flex items-center gap-3'>
                        <div className='border-primary/20 bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-xl border'>
                            <Palette className='h-6 w-6' />
                        </div>
                        <div>
                            <h1 className='text-xl font-semibold tracking-tight sm:text-2xl'>GPT 图像工坊</h1>
                            <p className='text-muted-foreground mt-1 text-xs'>从灵感到画面，生成、编辑与回看</p>
                        </div>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={busy || !settingsReady}
                            onClick={() => {
                                pending.current = null;
                                setApiOpen(true);
                            }}
                            className='max-w-full rounded-full'>
                            <Settings2 className='h-4 w-4' />
                            <span className='max-w-[200px] truncate'>{apiLabel}</span>
                        </Button>
                        {auth?.passwordRequired && (
                            <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                disabled={busy}
                                className='h-9 w-9 rounded-full'
                                aria-label='设置工作台访问密码'
                                onClick={() => {
                                    pending.current = null;
                                    setPasswordRetry(false);
                                    setPasswordOpen(true);
                                }}>
                                <LockKeyhole className='h-4 w-4' />
                            </Button>
                        )}
                    </div>
                </header>
                {authError && (
                    <div
                        role='alert'
                        className='border-destructive/30 bg-destructive/10 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm'>
                        <span>工作台配置读取失败，请检查本地服务或网络连接。</span>
                        <Button type='button' variant='outline' size='sm' onClick={() => void fetchAuth()}>
                            重新连接
                        </Button>
                    </div>
                )}
                {ready && !auth?.hasServerKey && !profileCredentials.apiKey && (
                    <div className='border-primary/30 bg-primary/5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3'>
                        <KeyRound className='text-primary h-5 w-5' />
                        <div className='min-w-0 flex-1'>
                            <p className='text-sm font-medium'>先连接图像服务</p>
                            <p className='text-muted-foreground mt-1 text-xs'>
                                配置 API 密钥后，即可生成和编辑图片。你也可以先准备提示词。
                            </p>
                        </div>
                        <Button
                            type='button'
                            size='sm'
                            onClick={() => {
                                pending.current = null;
                                setApiOpen(true);
                            }}>
                            设置 API
                        </Button>
                    </div>
                )}
                {storageWarning && (
                    <div
                        role='alert'
                        className='rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200'>
                        {storageWarning}
                    </div>
                )}
                {errorText && (
                    <div
                        id='workspace-error'
                        tabIndex={-1}
                        role='alert'
                        className='border-destructive/30 bg-destructive/10 flex scroll-mt-4 flex-wrap items-start gap-3 rounded-xl border p-3 text-sm'>
                        <AlertCircle className='text-destructive mt-0.5 h-4 w-4 shrink-0' />
                        <p className='min-w-0 flex-1 leading-6 break-words'>{errorText}</p>
                        <div className='flex gap-1'>
                            {job.error && lastRequest.current && (
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={busy}
                                    onClick={() => {
                                        if (lastRequest.current) void runRequest(lastRequest.current);
                                    }}>
                                    <RotateCcw className='h-3.5 w-3.5' />
                                    重试上次请求
                                </Button>
                            )}
                            <Button
                                type='button'
                                size='icon'
                                variant='ghost'
                                className='h-8 w-8'
                                aria-label='关闭错误提示'
                                onClick={() => {
                                    setActionError(null);
                                    job.clearError();
                                }}>
                                <X className='h-4 w-4' />
                            </Button>
                        </div>
                    </div>
                )}
                {(notice || job.notice) && (
                    <div
                        role='status'
                        className='border-border bg-card text-muted-foreground flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-5'>
                        <CheckCircle2 className='text-primary mt-0.5 h-4 w-4 shrink-0' />
                        <span>{notice || job.notice}</span>
                    </div>
                )}
                <nav aria-label='页面快捷导航' className='flex gap-2 lg:hidden'>
                    <Button variant='outline' size='sm' onClick={() => focusComposer()}>
                        创作
                    </Button>
                    <Button variant='outline' size='sm' onClick={showResults}>
                        查看结果
                        <ArrowDown className='h-3 w-3' />
                    </Button>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' })}>
                        历史记录
                    </Button>
                </nav>
                <div className='grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.15fr)] lg:gap-5'>
                    <section
                        id='composer'
                        aria-label='创作表单'
                        className='border-border bg-card flex scroll-mt-4 flex-col overflow-hidden rounded-2xl border lg:h-[min(800px,calc(100dvh-136px))] lg:min-h-[600px]'>
                        <div className='border-border shrink-0 border-b p-3'>
                            <ModeToggle currentMode={draft.mode} onModeChange={setMode} disabled={busy} />
                        </div>
                        <div className={draft.mode === 'generate' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
                            <GenerationForm
                                value={draft.generate}
                                onChange={(patch) => updateDraft('generate', patch)}
                                onSubmit={submit}
                                disabled={busy || !draftReady || !settingsReady || (!auth && !authError)}
                                isLoading={job.isRunning}
                                availableModels={availableModels}
                                modelsLoading={modelsLoading}
                                onRefreshModels={() => void refreshModels()}
                                onPresetSelect={(preset) => {
                                    presets.current.generate = preset;
                                }}
                            />
                        </div>
                        <div className={draft.mode === 'edit' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
                            <EditingForm
                                value={draft.edit}
                                onChange={(patch) => updateDraft('edit', patch)}
                                files={files}
                                onAddFiles={addFiles}
                                onChangeFiles={changeFiles}
                                onSubmit={submit}
                                disabled={busy || !draftReady || !settingsReady || (!auth && !authError)}
                                isLoading={job.isRunning}
                                availableModels={availableModels}
                                modelsLoading={modelsLoading}
                                onRefreshModels={() => void refreshModels()}
                                active={draft.mode === 'edit'}
                                onPresetSelect={(preset) => {
                                    presets.current.edit = preset;
                                }}
                            />
                        </div>
                    </section>
                    <div
                        id='results'
                        className='flex min-w-0 scroll-mt-4 flex-col lg:sticky lg:top-5 lg:h-[min(800px,calc(100dvh-136px))] lg:min-h-[600px]'>
                        {working && (
                            <p role='status' className='text-muted-foreground mb-2 flex items-center gap-2 text-xs'>
                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                正在读取图片…
                            </p>
                        )}
                        <ImageOutput
                            images={images}
                            selected={selected}
                            view={view}
                            onViewChange={setView}
                            phase={job.phase}
                            elapsedSeconds={job.elapsedSeconds}
                            previews={job.previews}
                            onCancel={job.cancel}
                            onSendToEdit={sendToEdit}
                            onCompose={() => focusComposer()}
                            disabled={busy}
                        />
                    </div>
                </div>
                <div id='history' className='min-w-0 scroll-mt-4'>
                    <HistoryPanel
                        history={historyStore.history}
                        selectedId={selected?.id}
                        confirmDeletion={!skipConfirmation}
                        onConfirmDeletionChange={(enabled) => {
                            setSkipConfirmation(!enabled);
                            try {
                                localStorage.setItem('imageGenSkipDeleteConfirm', String(!enabled));
                            } catch {}
                        }}
                        disabled={busy}
                        onSelect={(item) => {
                            if (!busy) void selectHistory(item);
                        }}
                        onRestore={restoreHistory}
                        onDelete={(item) => askDelete([item])}
                        onClear={() => askDelete(historyStore.history)}
                    />
                </div>
                <footer className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px]'>
                    <span>提示词和参数自动保存到此浏览器</span>
                    <span className='flex items-center gap-1.5'>
                        <CircleHelp className='h-3.5 w-3.5' />
                        {auth?.storageMode === 'indexeddb'
                            ? '图片保存在此浏览器，清理网站数据会移除图片'
                            : '图片保存在服务器，历史记录保存在此浏览器'}
                    </span>
                </footer>
            </div>
            <ApiSettingsDialog
                isOpen={apiOpen}
                onOpenChange={(open) => {
                    setApiOpen(open);
                    if (!open) setModelStatus(null);
                }}
                profiles={profileStore.profiles}
                activeId={profileStore.activeId}
                hasServerKey={!!auth?.hasServerKey}
                onSaveStore={saveProfileStoreState}
                onTestModels={testModels}
                modelStatus={modelStatus}
            />
            <PasswordDialog
                isOpen={passwordOpen}
                onOpenChange={(open) => {
                    setPasswordOpen(open);
                    if (!open) pending.current = null;
                }}
                onSave={savePassword}
                title={passwordRetry ? '请重新输入访问密码' : '访问密码'}
                description={
                    passwordRetry
                        ? '当前密码未通过验证。保存正确密码后会继续刚才的操作。'
                        : '此工作台需要访问密码。保存后会继续刚才的操作。'
                }
            />
            <Dialog
                open={!!deleteTargets}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setDeleteTargets(null);
                }}>
                <DialogContent className='sm:max-w-[440px]'>
                    <DialogHeader>
                        <DialogTitle>
                            {deleteTargets && deleteTargets.length > 1 ? '清空所选历史' : '删除这次创作'}
                        </DialogTitle>
                        <DialogDescription>
                            将移除 {deleteTargets?.length || 0}{' '}
                            条记录及其中不再被其他记录使用的图片。此操作无法撤销，请先下载需要保留的作品。
                        </DialogDescription>
                    </DialogHeader>
                    {deleteTargets?.length === 1 && (
                        <div className='flex items-center gap-2'>
                            <Checkbox
                                id='skip-delete-confirmation'
                                checked={confirmSkip}
                                disabled={isDeleting}
                                onCheckedChange={(value) => setConfirmSkip(value === true)}
                            />
                            <label htmlFor='skip-delete-confirmation' className='text-muted-foreground text-sm'>
                                单条删除时不再询问
                            </label>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            disabled={isDeleting}
                            onClick={() => setDeleteTargets(null)}>
                            取消
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={isDeleting}
                            onClick={() => {
                                if (!deleteTargets) return;
                                if (deleteTargets.length === 1) {
                                    setSkipConfirmation(confirmSkip);
                                    try {
                                        localStorage.setItem('imageGenSkipDeleteConfirm', String(confirmSkip));
                                    } catch {}
                                }
                                void executeDeletion(deleteTargets);
                            }}>
                            {isDeleting && <Loader2 className='h-4 w-4 animate-spin' />}
                            {isDeleting ? '正在删除…' : '确认删除'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
