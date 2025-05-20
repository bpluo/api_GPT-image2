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
import * as React from 'react';

interface PasswordDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (password: string) => void;
    title?: string;
    description?: string;
}

export function PasswordDialog({
    isOpen,
    onOpenChange,
    onSave,
    title = 'Configure Password',
    description
}: PasswordDialogProps) {
    const [currentPassword, setCurrentPassword] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleSave = () => {
        inputRef.current?.blur();
        onSave(currentPassword);
        setCurrentPassword('');
        onOpenChange(false);
    };

    const handleDialogClose = (open: boolean) => {
        if (!open) {
            setCurrentPassword('');
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent className='border-white/20 bg-black text-white sm:max-w-[425px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>{title}</DialogTitle>
                    {description && <DialogDescription className='text-white/60'>{description}</DialogDescription>}
                </DialogHeader>
                <div className='grid gap-4 py-4'>
                    <div className='grid grid-cols-1 items-center gap-4'>
                        <Input
                            ref={inputRef}
                            id='password-input'
                            type='password'
                            placeholder='Enter your password'
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className='col-span-1 border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && currentPassword.trim()) {
                                    e.preventDefault();
                                    handleSave();
                                }
                            }}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type='button'
                        onClick={handleSave}
                        disabled={!currentPassword.trim()}
                        className='bg-white px-6 text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
