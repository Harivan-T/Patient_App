import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic',
  ku: 'Kurdish (Sorani)',
};

const MAX_TEXTS = 50;
const MAX_TEXT_LENGTH = 500;

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  const { texts, locale } = await req.json() as { texts: string[]; locale: string };
  if (
    !Array.isArray(texts) || !texts.length || texts.length > MAX_TEXTS ||
    texts.some((t) => typeof t !== 'string' || t.length > MAX_TEXT_LENGTH) ||
    !locale || !LANG_NAMES[locale]
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ translations: texts });
  }

  const langName = LANG_NAMES[locale];
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Translate the following medical texts to ${langName}. Return ONLY the translations numbered the same way, one per line. Keep medical terms accurate.\n\n${numbered}`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error('Anthropic API error');

    const data = await res.json() as { content: Array<{ text: string }> };
    const raw = data.content?.[0]?.text ?? '';

    // Parse numbered lines back into array
    const translated = raw
      .split('\n')
      .filter((l: string) => /^\d+\./.test(l.trim()))
      .map((l: string) => l.replace(/^\d+\.\s*/, '').trim());

    // Pad with originals if parsing missed any
    const result = texts.map((orig, i) => translated[i] || orig);
    return NextResponse.json({ translations: result });
  } catch {
    // Fallback: return originals
    return NextResponse.json({ translations: texts });
  }
}
