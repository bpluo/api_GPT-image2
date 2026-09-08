'use client';

import { normalizeHistory, type HistoryMetadata } from '@/lib/history';
import * as React from 'react';

const HISTORY_KEY = 'openaiImageHistory';

export function useHistoryStore() {
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [ready, setReady] = React.useState(false);
    const [storageError, setStorageError] = React.useState<string | null>(null);
    const latest = React.useRef<HistoryMetadata[]>([]);
    const writable = React.useRef(true);

    const read = React.useCallback(() => {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            const normalized = normalizeHistory(parsed);
            if (normalized.length !== parsed.length) {
                localStorage.setItem(`${HISTORY_KEY}.recovery`, raw);
                setStorageError('部分旧记录格式异常，已保留备份；其余历史仍可使用。');
            }
            return normalized;
        } catch (error) {
            // 保留无法解析的数据，不把一次读取失败当成空历史写回。
            writable.current = false;
            throw error;
        }
    }, []);

    React.useEffect(() => {
        try {
            latest.current = read();
            setHistory(latest.current);
        } catch {
            setStorageError('历史记录未能读取，原始数据已保留。本次生成后请及时下载图片。');
        }
        setReady(true);
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== HISTORY_KEY) return;
            try {
                latest.current = read();
                setHistory(latest.current);
            } catch {
                setStorageError('另一个页面的历史数据无法读取，当前记录仍保留。');
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [read]);

    const update = React.useCallback(
        (mutate: (items: HistoryMetadata[]) => HistoryMetadata[]) => {
            let current = latest.current;
            if (writable.current) {
                try {
                    current = read();
                } catch {
                    /* 使用当前会话中的记录。 */
                }
            }
            const next = mutate(current);
            latest.current = next;
            setHistory(next);
            if (writable.current) {
                try {
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
                } catch {
                    writable.current = false;
                    setStorageError('历史记录未能保存，可能是浏览器空间不足。当前结果仍可下载，请导出历史备份。');
                }
            }
            return next;
        },
        [read]
    );

    const readCurrent = React.useCallback(() => {
        if (writable.current) {
            try {
                return read();
            } catch {
                /* 使用会话记录。 */
            }
        }
        return latest.current;
    }, [read]);
    return { history, ready, update, readCurrent, storageError };
}
