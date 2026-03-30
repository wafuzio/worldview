import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const url = formData.get('url') as string | null;
  const title = formData.get('title') as string;
  const sourceType = (formData.get('sourceType') as string) || 'impartial';

  let content = '';
  let documentPath = null;
  let documentType = null;
  let sourceUrl = url;

  // Handle file upload
  if (file) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    
    // Save file
    const filename = `${Date.now()}-${file.name}`;
    documentPath = join('uploads', filename);
    await writeFile(join(process.cwd(), documentPath), buffer);
    
    documentType = file.name.split('.').pop()?.toLowerCase();
    content = await extractTextFromFile(buffer, documentType || '');
  }
  
  // Handle URL fetch
  if (url && !file) {
    try {
      const response = await fetch(url);
      const html = await response.text();
      content = extractTextFromHtml(html);
      documentType = 'html';
    } catch (error) {
      return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 400 });
    }
  }

  // Create evidence record
  const evidence = await prisma.evidence.create({
    data: {
      title: title || 'Untitled Document',
      summary: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
      content,
      rawContent: content,
      sourceUrl,
      documentPath,
      documentType,
      sourceClassification: sourceType === 'primary' ? 'primary_source' : 'secondary_source',
      isProcessed: false,
    },
  });

  return NextResponse.json(evidence);
}

async function extractTextFromFile(buffer: Buffer, type: string): Promise<string> {
  // For now, handle plain text files
  // PDF and DOCX would require additional libraries
  if (type === 'txt' || type === 'md') {
    return buffer.toString('utf-8');
  }
  
  // For other types, return placeholder
  // In production, use pdf-parse for PDFs, mammoth for DOCX
  return buffer.toString('utf-8');
}

function extractTextFromHtml(html: string): string {
  // Simple HTML text extraction
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
