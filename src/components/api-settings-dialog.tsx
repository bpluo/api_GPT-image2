'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from '@/lib/api-config';
import { hostLabel, MAX_PROFILES, type ApiProfile } from '@/lib/api-profiles';
import { Check, Eye, EyeOff, Loader2, Pencil, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';
import * as React from 'react';

export function ApiSettingsDialog({
    isOpen,
    onOpenChange,
    profiles,
    activeId,
    hasServerKey,
    onSaveStore,
    onTestModels,
    modelStatus
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    profiles: ApiProfile[];
    activeId: string | null;
    hasServerKey: boolean;
    onSaveStore: (profiles: ApiProfile[], activeId: string | null) => void;
    onTestModels: (profile: Pick<ApiProfile, 'apiKey' | 'baseUrl'>) => Promise<string[]>;
    modelStatus: { loading: boolean; models: string[]; error: string | null } | null;
}) {
    const [draft, setDraft] = React.useState<ApiProfile | null>(null);
    const [showKey, setShowKey] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [testing, setTesting] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setDraft(null);
            setError(null);
            setShowKey(false);
        }
    }, [isOpen]);

    const startCreate = () => {
        setError(null);
        setDraft({
            id: `draft-${Date.now()}`,
            name: '',
            baseUrl: '',
            apiKey: ''
        });
    };
    const startEdit = (profile: ApiProfile) => {
        setError(null);
        setDraft({ ...profile });
    };

    const saveDraft = async () => {
        if (!draft) return;
        setError(null);
        try {
            const apiKey = draft.apiKey.trim();
            const baseUrl = draft.baseUrl.trim();
            if (!apiKey) throw new Error(hasServerKey && !baseUrl ? '请填写 API Key，或直接使用服务端配置。' : '请填写 API Key 后再保存。');
            const normalized = baseUrl ? normalizeApiBaseUrl(baseUrl) : '';
            const name = draft.name.trim() || hostLabel(normalized);
            const isEditing = profiles.some((profile) => profile.id === draft.id);
            const next = isEditing
                ? profiles.map((profile) =>
                      profile.id === draft.id ? { ...draft, name, apiKey, baseUrl: normalized } : profile
                  )
                : [...profiles, { ...draft, name, apiKey, baseUrl: normalized }];
            if (!isEditing && next.length > MAX_PROFILES)
                throw new Error(`最多保存 ${MAX_PROFILES} 份配置，请先删除不用的配置。`);
            // 新建的第一份配置自动启用；其余情况保持当前选择。
            const nextActive = !isEditing && !activeId ? draft.id : activeId;
            onSaveStore(next, nextActive);
            setDraft(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '设置保存失败，请重试。');
        }
    };

    const remove = (profile: ApiProfile) => {
        const next = profiles.filter((item) => item.id !== profile.id);
        const nextActive = activeId === profile.id ? (next[0]?.id ?? null) : activeId;
        onSaveStore(next, nextActive);
    };

    const testModels = async () => {
        if (!draft || testing) return;
        setError(null);
        setTesting(true);
        try {
            const apiKey = draft.apiKey.trim();
            if (!apiKey) throw new Error('请先填写 API Key 再测试。');
            const models = await onTestModels({ apiKey, baseUrl: draft.baseUrl.trim() });
            if (!models.length) throw new Error('接口未返回模型，可稍后在模型下拉中手动输入。');
            if (!draft.name.trim())
                setDraft((current) => (current ? { ...current, name: hostLabel(draft.baseUrl.trim()) } : current));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '模型列表获取失败，请重试。');
        } finally {
            setTesting(false);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!draft) onOpenChange(open);
            }}>
            <DialogContent className='sm:max-w-[520px]'>
                <DialogHeader>
                    <DialogTitle>API 设置</DialogTitle>
                    <DialogDescription>
                        保存多份服务商配置，切换使用；或使用已配置的服务端接口。
                    </DialogDescription>
                </DialogHeader>
                {draft ? (
                    <form
                        className='space-y-4'
                        onSubmit={(event) => {
                            event.preventDefault();
                            void saveDraft();
                        }}>
                        <div className='space-y-2'>
                            <Label htmlFor='profile-name'>
                                配置名称 <span className='text-muted-foreground font-normal'>（可选）</span>
                            </Label>
                            <Input
                                id='profile-name'
                                type='text'
                                maxLength={30}
                                placeholder={hostLabel(draft.baseUrl)}
                                value={draft.name}
                                disabled={testing}
                                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='api-base-url'>
                                接口地址 <span className='text-muted-foreground font-normal'>（可选）</span>
                            </Label>
                            <Input
                                id='api-base-url'
                                type='text'
                                inputMode='url'
                                autoCapitalize='none'
                                spellCheck={false}
                                placeholder={DEFAULT_API_BASE_URL}
                                value={draft.baseUrl}
                                disabled={testing}
                                onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                                aria-describedby='api-url-help'
                            />
                            <p id='api-url-help' className='text-muted-foreground text-xs leading-5'>
                                填写服务商给出的接口根地址；只填域名时会自动补上 /v1。留空则使用 OpenAI
                                官方接口。
                            </p>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='api-key'>API Key</Label>
                            <div className='relative'>
                                <Input
                                    id='api-key'
                                    type={showKey ? 'text' : 'password'}
                                    autoComplete='off'
                                    spellCheck={false}
                                    placeholder='填写你的 API 密钥'
                                    value={draft.apiKey}
                                    disabled={testing}
                                    className='pr-11'
                                    onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                                />
                                <button
                                    type='button'
                                    className='text-muted-foreground hover:text-foreground absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded'
                                    aria-label={showKey ? '隐藏 API 密钥' : '显示 API 密钥'}
                                    onClick={() => setShowKey(!showKey)}>
                                    {showKey ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                                </button>
                            </div>
                            <p className='text-muted-foreground text-xs'>配置保存在当前浏览器中，仅在生成或编辑时使用。</p>
                        </div>
                        {modelStatus && modelStatus.models.length > 0 && (
                            <div className='bg-muted/50 space-y-1 rounded-lg p-3'>
                                <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                                    <RefreshCw className='h-3 w-3' />
                                    已获取 {modelStatus.models.length} 个模型，生成页的模型列表会自动更新。
                                </p>
                                <p className='text-muted-foreground truncate text-[11px]' title={modelStatus.models.join('、')}>
                                    {rankPreview(modelStatus.models)}
                                </p>
                            </div>
                        )}
                        {error && (
                            <p role='alert' className='text-destructive text-sm'>
                                {error}
                            </p>
                        )}
                        <DialogFooter className='gap-2'>
                            <Button
                                type='button'
                                variant='ghost'
                                disabled={testing}
                                onClick={() => {
                                    setDraft(null);
                                    setError(null);
                                }}>
                                返回列表
                            </Button>
                            <Button
                                type='button'
                                variant='outline'
                                disabled={testing}
                                onClick={() => void testModels()}>
                                {testing ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                                获取模型
                            </Button>
                            <Button type='submit' disabled={testing}>
                                保存配置
                            </Button>
                        </DialogFooter>
                    </form>
                ) : (
                    <div className='space-y-3'>
                        {profiles.length > 0 && (
                            <ul className='space-y-2'>
                                {profiles.map((profile) => {
                                    const isActive = profile.id === activeId;
                                    return (
                                        <li key={profile.id}>
                                            <div
                                                className={`flex items-center gap-2 rounded-lg border p-3 ${
                                                    isActive ? 'border-primary bg-primary/10' : 'border-border'
                                                }`}>
                                                <div className='min-w-0 flex-1'>
                                                    <p className='flex items-center gap-1.5 text-sm font-medium'>
                                                        {profile.name}
                                                    </p>
                                                    <p className='text-muted-foreground truncate text-xs'>
                                                        {profile.baseUrl || 'OpenAI 官方接口'}
                                                    </p>
                                                </div>
                                                <Button
                                                    type='button'
                                                    variant={isActive ? 'default' : 'outline'}
                                                    size='sm'
                                                    onClick={() => {
                                                        if (!isActive) onSaveStore(profiles, profile.id);
                                                    }}
                                                    aria-label={`使用配置 ${profile.name}`}
                                                    disabled={isActive}>
                                                    {isActive ? <Check className='h-4 w-4' /> : null}
                                                    {isActive ? '使用中' : '使用'}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='icon'
                                                    className='h-8 w-8'
                                                    aria-label={`编辑配置 ${profile.name}`}
                                                    onClick={() => startEdit(profile)}>
                                                    <Pencil className='h-4 w-4' />
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='icon'
                                                    className='hover:text-destructive h-8 w-8'
                                                    aria-label={`删除配置 ${profile.name}`}
                                                    onClick={() => remove(profile)}>
                                                    <Trash2 className='h-4 w-4' />
                                                </Button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {hasServerKey && (
                            <div className='border-border flex items-center gap-2 rounded-lg border p-3'>
                                <Server className='text-muted-foreground h-4 w-4' />
                                <div className='min-w-0 flex-1'>
                                    <p className='text-sm font-medium'>服务端配置</p>
                                    <p className='text-muted-foreground text-xs'>
                                        使用部署时配置的密钥，未选择个人配置时生效。
                                    </p>
                                </div>
                                {!activeId && <span className='text-primary text-xs font-medium'>使用中</span>}
                            </div>
                        )}
                        {!profiles.length && !hasServerKey && (
                            <p className='bg-primary/10 text-primary rounded-lg p-3 text-xs leading-5'>
                                添加一份配置即可开始创作。兼容接口需填写服务商的接口地址和密钥。
                            </p>
                        )}
                        {error && (
                            <p role='alert' className='text-destructive text-sm'>
                                {error}
                            </p>
                        )}
                        <div className='flex justify-end gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => onOpenChange(false)}>
                                关闭
                            </Button>
                            <Button
                                type='button'
                                disabled={profiles.length >= MAX_PROFILES}
                                onClick={startCreate}>
                                <Plus className='h-4 w-4' />
                                添加配置
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function rankPreview(models: string[]): string {
    const sorted = [...models].sort((a, b) => {
        const score = (model: string) => (/^gpt-image|^agnes-image/.test(model) ? 0 : 1);
        return score(a) - score(b) || a.localeCompare(b);
    });
    const shown = sorted.slice(0, 6).join('、');
    return sorted.length > 6 ? `${shown} 等 ${sorted.length} 个` : shown;
}
