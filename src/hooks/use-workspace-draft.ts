'use client';

import {
    DEFAULT_IMAGE_SETTINGS,
    normalizeImageSettings,
    type ImageMode,
    type ImageSettings
} from '@/lib/image-settings';
import * as React from 'react';

const DRAFT_KEY = 'imageWorkshopDraft.v1';
type Draft = { mode: ImageMode; generate: ImageSettings; edit: ImageSettings };

export function useWorkspaceDraft() {
    const [draft, setDraft] = React.useState<Draft>({
        mode: 'generate',
        generate: { ...DEFAULT_IMAGE_SETTINGS },
        edit: { ...DEFAULT_IMAGE_SETTINGS }
    });
    const [ready, setReady] = React.useState(false);
    const [storageError, setStorageError] = React.useState<string | null>(null);
    const latest = React.useRef(draft);
    latest.current = draft;

    React.useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setDraft({
                    mode: parsed.mode === 'edit' ? 'edit' : 'generate',
                    generate: normalizeImageSettings(parsed.generate),
                    edit: normalizeImageSettings(parsed.edit)
                });
            }
        } catch {
            setStorageError('浏览器中的草稿未能读取，请检查浏览器存储权限。');
        }
        setReady(true);
    }, []);

    const save = React.useCallback(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(latest.current));
            setStorageError(null);
        } catch {
            setStorageError('草稿暂时无法保存到浏览器，刷新前请复制提示词。');
        }
    }, []);

    React.useEffect(() => {
        if (!ready) return;
        const timer = window.setTimeout(save, 300);
        window.addEventListener('pagehide', save);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('pagehide', save);
        };
    }, [draft, ready, save]);

    const update = React.useCallback((mode: ImageMode, patch: Partial<ImageSettings>) => {
        setDraft((current) => ({ ...current, [mode]: normalizeImageSettings({ ...current[mode], ...patch }) }));
    }, []);
    const setMode = React.useCallback((mode: ImageMode) => setDraft((current) => ({ ...current, mode })), []);
    return { draft, ready, update, setMode, storageError };
}
