import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isAllowedRemoteUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url || !isAllowedRemoteUrl(url)) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'worldview-image-proxy/1.0' },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream failed: ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    const data = await upstream.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Image fetch failed' }, { status: 500 });
  }
}
