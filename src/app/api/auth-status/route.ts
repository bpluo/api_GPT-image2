import { NextResponse } from 'next/server';

export async function GET() {
    const appPasswordSet = !!process.env.APP_PASSWORD;
    return NextResponse.json({ passwordRequired: appPasswordSet });
}
