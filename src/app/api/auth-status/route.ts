import { getStorageMode } from '@/lib/server-config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const appPasswordSet = !!process.env.APP_PASSWORD;
    // Lets the frontend know whether requests without an X-Api-Key header can still work.
    const hasServerKey = !!process.env.OPENAI_API_KEY?.trim();
    return NextResponse.json(
        { passwordRequired: appPasswordSet, hasServerKey, storageMode: getStorageMode() },
        { headers: { 'Cache-Control': 'no-store' } }
    );
}
