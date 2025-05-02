import fs from 'fs/promises';
import { lookup } from 'mime-types';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Base directory where images are stored (outside nextjs-app)
const imageBaseDir = path.resolve(process.cwd(), 'generated-images');

export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
    const { filename } = await params;

    if (!filename) {
        return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Basic security: Prevent directory traversal
    if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filepath = path.join(imageBaseDir, filename);

    try {
        await fs.access(filepath);

        const fileBuffer = await fs.readFile(filepath);

        const contentType = lookup(filename) || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileBuffer.length.toString()
            }
        });
    } catch (error: unknown) {
        console.error(`Error serving image ${filename}:`, error);
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
