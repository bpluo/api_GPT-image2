'use client';

import * as React from 'react';

export function useFilePreviews(files: File[]) {
    const cache = React.useRef(new Map<File, string>());
    const [previews, setPreviews] = React.useState(new Map<File, string>());
    React.useEffect(() => {
        const urls = cache.current;
        for (const [file, url] of urls) {
            if (!files.includes(file)) {
                URL.revokeObjectURL(url);
                urls.delete(file);
            }
        }
        for (const file of files) if (!urls.has(file)) urls.set(file, URL.createObjectURL(file));
        setPreviews(new Map(urls));
    }, [files]);
    React.useEffect(() => {
        const urls = cache.current;
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
        };
    }, []);
    return previews;
}
