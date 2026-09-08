import type { StorageMode } from './image-settings';
import crypto from 'crypto';

export function getStorageMode(): StorageMode {
    if (process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE === 'fs') return 'fs';
    if (process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE === 'indexeddb') return 'indexeddb';
    return process.env.VERCEL === '1' ? 'indexeddb' : 'fs';
}

export function checkAppPassword(hash: unknown) {
    if (!process.env.APP_PASSWORD) return null;
    if (!hash) return { error: '此工作台需要访问密码，请先输入密码。', code: 'APP_PASSWORD_REQUIRED' };
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
        return { error: '访问密码不正确，请重新输入。', code: 'APP_PASSWORD_INVALID' };
    }
    const expected = crypto.createHash('sha256').update(process.env.APP_PASSWORD).digest();
    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), expected)) {
        return { error: '访问密码不正确，请重新输入。', code: 'APP_PASSWORD_INVALID' };
    }
    return null;
}
