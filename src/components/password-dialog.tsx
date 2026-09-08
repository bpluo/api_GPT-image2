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
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export function PasswordDialog({
    isOpen,
    onOpenChange,
    onSave,
    title = '访问密码',
    description = '此工作台需要访问密码。验证后会继续刚才的操作。'
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (password: string) => void | Promise<void>;
    title?: string;
    description?: string;
}) {
    const [password, setPassword] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError(null);
        }
    }, [isOpen]);
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!saving) onOpenChange(open);
            }}>
            <DialogContent className='sm:max-w-[425px]'>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <form
                    className='space-y-4'
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (!password.trim() || saving) return;
                        setSaving(true);
                        setError(null);
                        try {
                            await onSave(password);
                            setPassword('');
                        } catch (cause) {
                            setError(cause instanceof Error ? cause.message : '密码保存失败，请重试。');
                        } finally {
                            setSaving(false);
                        }
                    }}>
                    <div className='space-y-2'>
                        <Label htmlFor='workspace-password'>访问密码</Label>
                        <Input
                            id='workspace-password'
                            type='password'
                            autoComplete='current-password'
                            value={password}
                            disabled={saving}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder='输入工作台的访问密码'
                        />
                    </div>
                    {error && (
                        <p role='alert' className='text-destructive text-sm'>
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button type='button' variant='outline' disabled={saving} onClick={() => onOpenChange(false)}>
                            取消
                        </Button>
                        <Button type='submit' disabled={!password.trim() || saving}>
                            {saving && <Loader2 className='h-4 w-4 animate-spin' />}保存并继续
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
