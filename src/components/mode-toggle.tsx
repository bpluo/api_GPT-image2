'use client';

import type { ImageMode } from '@/lib/image-settings';
import { cn } from '@/lib/utils';
import { Pencil, Sparkles } from 'lucide-react';

export function ModeToggle({
    currentMode,
    onModeChange,
    disabled = false
}: {
    currentMode: ImageMode;
    onModeChange: (mode: ImageMode) => void;
    disabled?: boolean;
}) {
    return (
        <div role='group' aria-label='创作模式' className='bg-background/65 grid grid-cols-2 gap-1 rounded-xl p-1'>
            {(
                [
                    { mode: 'generate', label: '生成图片', Icon: Sparkles },
                    { mode: 'edit', label: '编辑图片', Icon: Pencil }
                ] as const
            ).map(({ mode, label, Icon }) => (
                <button
                    key={mode}
                    type='button'
                    aria-pressed={currentMode === mode}
                    disabled={disabled}
                    onClick={() => onModeChange(mode)}
                    className={cn(
                        'focus-visible:ring-ring flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 disabled:opacity-60',
                        currentMode === mode
                            ? 'bg-card text-primary ring-border shadow-sm ring-1'
                            : 'text-muted-foreground hover:text-foreground'
                    )}>
                    <Icon className='h-4 w-4' />
                    {label}
                </button>
            ))}
        </div>
    );
}
