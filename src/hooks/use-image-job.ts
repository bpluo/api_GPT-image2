'use client';

import {
    ImageRequestError,
    requestImages,
    type ApiCredentials,
    type ImageRequest,
    type ImageResult
} from '@/lib/image-request';
import * as React from 'react';

export function useImageJob() {
    const [phase, setPhase] = React.useState<'idle' | 'requesting' | 'saving'>('idle');
    const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
    const [error, setError] = React.useState<ImageRequestError | null>(null);
    const [notice, setNotice] = React.useState<string | null>(null);
    const [previews, setPreviews] = React.useState<Map<number, string>>(new Map());
    const active = React.useRef<{ controller: AbortController; started: number; saving: boolean } | null>(null);

    React.useEffect(
        () => () => {
            active.current?.controller.abort();
        },
        []
    );
    React.useEffect(() => {
        if (phase === 'idle') return;
        const timer = window.setInterval(() => {
            if (active.current) setElapsedSeconds(Math.floor((Date.now() - active.current.started) / 1000));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [phase]);

    const run = React.useCallback(
        async (
            request: ImageRequest,
            credentials: ApiCredentials,
            onComplete: (result: ImageResult, durationMs: number) => Promise<void>
        ) => {
            if (active.current) return null;
            const controller = new AbortController();
            const started = Date.now();
            active.current = { controller, started, saving: false };
            setPhase('requesting');
            setElapsedSeconds(0);
            setPreviews(new Map());
            setError(null);
            setNotice(null);
            let timedOut = false;
            const timeout = window.setTimeout(
                () => {
                    timedOut = true;
                    controller.abort();
                },
                10 * 60 * 1000
            );
            try {
                const result = await requestImages(request, credentials, controller.signal, (index, url) => {
                    if (!controller.signal.aborted) setPreviews((current) => new Map(current).set(index, url));
                });
                controller.signal.throwIfAborted();
                active.current.saving = true;
                window.clearTimeout(timeout);
                setPhase('saving');
                await onComplete(result, Date.now() - started);
                return null;
            } catch (cause) {
                if (controller.signal.aborted && !timedOut) return null;
                const failure = timedOut
                    ? new ImageRequestError(
                          '等待已超过 10 分钟。请检查接口状态后重试；原提示词和结果已保留。',
                          'TIMEOUT'
                      )
                    : cause instanceof ImageRequestError
                      ? cause
                      : new ImageRequestError(cause instanceof Error ? cause.message : '请求失败，请稍后重试。');
                setError(failure);
                return failure;
            } finally {
                window.clearTimeout(timeout);
                active.current = null;
                setPhase('idle');
                setPreviews(new Map());
            }
        },
        []
    );

    const cancel = React.useCallback(() => {
        if (!active.current || active.current.saving) return;
        active.current.controller.abort();
        setNotice('已停止等待，提示词和已有结果已保留。上游可能已开始处理，费用以服务商记录为准。');
    }, []);

    return {
        phase,
        isRunning: phase !== 'idle',
        elapsedSeconds,
        error,
        notice,
        previews,
        run,
        cancel,
        clearError: () => setError(null)
    };
}
