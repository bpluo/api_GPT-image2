import { isSafeImageFilename, resolveImageReadPath } from '@/lib/image-storage';
import { checkAppPassword } from '@/lib/server-config';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: '删除请求必须为有效的 JSON。' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') return NextResponse.json({ error: '删除请求内容无效。' }, { status: 400 });
    const authError = checkAppPassword(body.passwordHash);
    if (authError) return NextResponse.json(authError, { status: 401 });
    if (
        !Array.isArray(body.filenames) ||
        body.filenames.length > 100 ||
        body.filenames.some((name: unknown) => typeof name !== 'string')
    ) {
        return NextResponse.json({ error: '每次可删除至多 100 个有效图片文件。' }, { status: 400 });
    }
    const results = await Promise.all(
        [...new Set<string>(body.filenames)].map(async (filename) => {
            if (!isSafeImageFilename(filename)) return { filename, success: false, error: '图片文件名无效。' };
            try {
                const filepath = await resolveImageReadPath(filename);
                if (filepath) await fs.unlink(filepath);
                // 已不存在的文件也视为完成，让重复操作和旧历史清理可以恢复。
                return { filename, success: true };
            } catch (error) {
                if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
                    return { filename, success: true };
                return { filename, success: false, error: '文件未能删除，请检查目录权限后重试。' };
            }
        })
    );
    return NextResponse.json({ results }, { status: results.every((result) => result.success) ? 200 : 207 });
}
