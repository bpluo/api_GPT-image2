import fs from 'fs/promises';
import path from 'path';

const DEFAULT_IMAGE_DIR = 'generated-images';
const DEFAULT_LEGACY_PROJECT_DIR = 'gpt-image-playground';

const uniquePaths = (dirs: string[]) => {
    const seen = new Set<string>();
    return dirs.filter((dir) => {
        const resolved = path.resolve(dir);
        const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export function getPrimaryImageDir() {
    const configuredDir = process.env.IMAGE_STORAGE_DIR?.trim();
    return configuredDir ? path.resolve(configuredDir) : path.resolve(process.cwd(), DEFAULT_IMAGE_DIR);
}

export function getImageSearchDirs() {
    const envLegacyDirs = (process.env.LEGACY_IMAGE_STORAGE_DIRS || '')
        .split(path.delimiter)
        .map((dir) => dir.trim())
        .filter(Boolean)
        .map((dir) => path.resolve(dir));

    const siblingLegacyDir = path.resolve(process.cwd(), '..', DEFAULT_LEGACY_PROJECT_DIR, DEFAULT_IMAGE_DIR);

    return uniquePaths([getPrimaryImageDir(), ...envLegacyDirs, siblingLegacyDir]);
}

export function isSafeImageFilename(filename: string) {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return false;
    if (path.basename(filename) !== filename) return false;
    return /^[\w.-]+\.(png|jpe?g|webp)$/i.test(filename);
}

export async function ensurePrimaryImageDirExists() {
    const outputDir = getPrimaryImageDir();

    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            await fs.mkdir(outputDir, { recursive: true });
            console.log(`Created output directory: ${outputDir}`);
            return outputDir;
        }

        console.error(`Error accessing output directory ${outputDir}:`, error);
        throw new Error(
            `Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    return outputDir;
}

export async function resolveImageReadPath(filename: string) {
    if (!isSafeImageFilename(filename)) return null;

    for (const dir of getImageSearchDirs()) {
        const filepath = path.join(dir, filename);
        try {
            await fs.access(filepath);
            return filepath;
        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
                continue;
            }
            throw error;
        }
    }

    return null;
}
