'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PromptTemplate } from '@/lib/preset-prompts';
import { FileText, Plus, Replace } from 'lucide-react';
import * as React from 'react';

type AcademicPromptPickerProps = {
    prompts: PromptTemplate[];
    disabled?: boolean;
    onReplace: (prompt: PromptTemplate) => void;
    onAppend: (prompt: PromptTemplate) => void;
};

export function AcademicPromptPicker({ prompts, disabled, onReplace, onAppend }: AcademicPromptPickerProps) {
    const [selectedTitle, setSelectedTitle] = React.useState(prompts[0]?.title ?? '');
    const selectedPrompt = prompts.find((prompt) => prompt.title === selectedTitle) ?? prompts[0];

    if (!selectedPrompt) return null;

    return (
        <div className='space-y-3 rounded-2xl border border-border/70 bg-background/45 p-3'>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <Label className='flex items-center gap-2 text-sm font-medium text-foreground'>
                        <FileText className='h-4 w-4 text-primary' />
                        科研绘图模板
                    </Label>
                    <p className='mt-1 text-xs text-muted-foreground'>选择论文图类型，再覆盖或追加到当前提示词。</p>
                </div>
            </div>

            <Select value={selectedTitle} onValueChange={setSelectedTitle} disabled={disabled}>
                <SelectTrigger className='rounded-xl border-border bg-background/70 text-foreground'>
                    <SelectValue placeholder='选择科研模板' />
                </SelectTrigger>
                <SelectContent className='border-border bg-popover text-popover-foreground'>
                    {prompts.map((prompt) => (
                        <SelectItem key={prompt.title} value={prompt.title}>
                            {prompt.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className='rounded-xl border border-border/60 bg-card/50 p-3'>
                <div className='text-sm font-medium text-foreground'>{selectedPrompt.title}</div>
                {selectedPrompt.description && <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>{selectedPrompt.description}</p>}
                {selectedPrompt.tags && selectedPrompt.tags.length > 0 && (
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {selectedPrompt.tags.map((tag) => (
                            <span key={tag} className='rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground'>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className='grid grid-cols-2 gap-2'>
                <Button type='button' variant='outline' size='sm' disabled={disabled} onClick={() => onReplace(selectedPrompt)} className='rounded-full'>
                    <Replace className='mr-2 h-3.5 w-3.5' />
                    覆盖提示词
                </Button>
                <Button type='button' size='sm' disabled={disabled} onClick={() => onAppend(selectedPrompt)} className='rounded-full'>
                    <Plus className='mr-2 h-3.5 w-3.5' />
                    追加规范
                </Button>
            </div>
        </div>
    );
}
