'use client';

/* eslint-disable @next/next/no-img-element */
import { getStoredImage } from '@/lib/db';
import type { StorageMode } from '@/lib/image-settings';
import { ImageOff } from 'lucide-react';
import * as React from 'react';

export function StoredImage({
    filename,
    storageMode,
    alt,
    className
}: {
    filename: string;
    storageMode: StorageMode;
    alt: string;
    className?: string;
}) {
    const [source, setSource] = React.useState<string | null>(null);
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => {
        let active = true;
        let url: string | undefined;
        setFailed(false);
        setSource(null);
        if (storageMode === 'fs') setSource(`/api/image/${encodeURIComponent(filename)}`);
        else {
            getStoredImage(filename)
                .then((record) => {
                    if (!active) return;
                    if (!record?.blob) {
                        setFailed(true);
                        return;
                    }
                    url = URL.createObjectURL(record.blob);
                    setSource(url);
                })
                .catch(() => {
                    if (active) setFailed(true);
                });
        }
        return () => {
            active = false;
            if (url) URL.revokeObjectURL(url);
        };
    }, [filename, storageMode]);
    if (failed)
        return (
            <div className='bg-muted/20 text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2'>
                <ImageOff className='h-5 w-5' />
                <span className='text-[11px]'>图片无法读取</span>
            </div>
        );
    if (!source) return <div className='bg-muted/40 h-full w-full animate-pulse' aria-label='正在读取图片' />;
    return <img src={source} alt={alt} loading='lazy' className={className} onError={() => setFailed(true)} />;
}
