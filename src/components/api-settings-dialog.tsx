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
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import * as React from 'react';

export function ApiSettingsDialog({
    isOpen,
    onOpenChange,
    baseUrl,
    apiKey,
    onSave,
    hasServerKey
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    baseUrl: string;
    apiKey: string;
    onSave: (baseUrl: string, apiKey: string) => void | Promise<void>;
    hasServerKey: boolean;
}) {
    const [urlInput, setUrlInput] = React.useState(baseUrl);
    const [keyInput, setKeyInput] = React.useState(apiKey);
    const [showKey, setShowKey] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (isOpen) {
            setUrlInput(baseUrl);
            setKeyInput(apiKey);
            setError(null);
            setShowKey(false);
        }
    }, [isOpen, baseUrl, apiKey]);
    const save = async (useServer = false) => {
        setError(null);
        setSaving(true);
        try {
            const key = useServer ? '' : keyInput.trim();
            const url = useServer ? '' : urlInput.trim();
            if (!key && url) throw new Error('填写自定义接口地址时，也需要填写自己的 API Key。');
            if (!key && !hasServerKey) throw new Error('请填写 API Key 后再保存。');
            const normalized = url ? normalizeApiBaseUrl(url) : '';
            await onSave(normalized, key);
            onOpenChange(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '设置保存失败，请重试。');
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!saving) onOpenChange(open);
            }}>
            <DialogContent className='sm:max-w-[480px]'>
                <DialogHeader>
                    <DialogTitle>API 设置</DialogTitle>
                    <DialogDescription>使用自己的 API 密钥，或使用已配置的服务端接口。</DialogDescription>
                </DialogHeader>
                <form
                    className='space-y-5'
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                    }}>
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
                            value={urlInput}
                            disabled={saving}
                            onChange={(event) => {
                                setUrlInput(event.target.value);
                                setError(null);
                            }}
                            aria-describedby='api-url-help'
                        />
                        <p id='api-url-help' className='text-muted-foreground text-xs leading-5'>
                            填写服务商给出的接口根地址；只填域名时会自动补上 /v1。留空则使用 OpenAI 官方接口。
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
                                value={keyInput}
                                disabled={saving}
                                className='pr-11'
                                onChange={(event) => {
                                    setKeyInput(event.target.value);
                                    setError(null);
                                }}
                            />
                            <button
                                type='button'
                                className='text-muted-foreground hover:text-foreground absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded'
                                aria-label={showKey ? '隐藏 API 密钥' : '显示 API 密钥'}
                                onClick={() => setShowKey(!showKey)}>
                                {showKey ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                            </button>
                        </div>
                        <p className='text-muted-foreground text-xs'>设置保存在当前浏览器中，仅在生成或编辑时使用。</p>
                    </div>
                    {!hasServerKey && (
                        <p className='bg-primary/10 text-primary rounded-lg p-3 text-xs leading-5'>
                            填写密钥即可开始创作。兼容接口还需填写服务商的接口地址。
                        </p>
                    )}
                    {error && (
                        <p role='alert' className='text-destructive text-sm'>
                            {error}
                        </p>
                    )}
                    <DialogFooter className='gap-2'>
                        {hasServerKey && (
                            <Button
                                type='button'
                                variant='ghost'
                                className='sm:mr-auto'
                                disabled={saving}
                                onClick={() => void save(true)}>
                                使用服务端配置
                            </Button>
                        )}
                        <Button type='button' variant='outline' disabled={saving} onClick={() => onOpenChange(false)}>
                            取消
                        </Button>
                        <Button type='submit' disabled={saving}>
                            {saving && <Loader2 className='h-4 w-4 animate-spin' />}保存设置
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
