import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a medical triage assistant for a demo healthcare app.
Based on the patient-provided information below, produce a short differential
diagnosis and triage recommendation. Do NOT give a definitive diagnosis.

Respond ONLY as a JSON object with this exact structure:
{
  "possibleDiagnoses": ["condition one", "condition two", ...],
  "urgency": "low" | "medium" | "high",
  "advice": "short non-clinical advice text"
}

Patient information:`;

interface DiagnoseRequestBody {
  zones?: string[];
  areaSymptoms?: Record<string, string[]>;
  painLevel?: number;
  duration?: string;
  notes?: string;
  movementPain?: boolean;
  nightPain?: boolean;
  takingMedication?: boolean;
  hasFever?: boolean;
}

function buildPrompt(body: DiagnoseRequestBody): { info: string; prompt: string } {
  const {
    zones,
    areaSymptoms,
    painLevel,
    duration,
    notes,
    movementPain,
    nightPain,
    takingMedication,
    hasFever,
  } = body;

  const info = [
    `Affected body areas: ${(zones || []).join(', ') || 'none'}`,
    `Symptoms by area: ${JSON.stringify(areaSymptoms || {})}`,
    `Pain level: ${painLevel || 'not specified'}/10`,
    `Duration: ${duration || 'not specified'}`,
    `Patient notes: ${notes || 'none'}`,
    `Movement worsens pain: ${movementPain ? 'yes' : 'no'}`,
    `Night pain: ${nightPain ? 'yes' : 'no'}`,
    `Taking medication: ${takingMedication ? 'yes' : 'no'}`,
    `Fever: ${hasFever ? 'yes' : 'no'}`,
  ].join('\n');

  return { info, prompt: `${SYSTEM_PROMPT}\n${info}\n\nJSON response:` };
}

async function fetchGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[diagnose] Gemini error', err);
    throw new Error(`Gemini request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function fetchOllama(prompt: string): Promise<string> {
  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3';
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: 'json',
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.response || '';
}

function getDemoResult(body: DiagnoseRequestBody) {
  const painLevel = typeof body.painLevel === 'number' ? body.painLevel : 5;
  const hasFever = !!body.hasFever;
  const urgency = painLevel >= 7 || hasFever ? 'medium' : 'low';

  return {
    possibleDiagnoses: ['Minor soft-tissue strain', 'Non-specific pain syndrome'],
    urgency,
    advice:
      'Rest the affected area, avoid activities that worsen the pain, and monitor symptoms. Seek medical care if the pain worsens, persists beyond a few days, or is accompanied by fever, numbness, or severe limitation.',
    source: 'demo-fallback',
  };
}

function parseAiText(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/```json\s?/gi, '')
    .replace(/```\s?/gi, '')
    .trim();
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = buildPrompt(body);

    const provider = process.env.AI_PROVIDER || 'gemini';
    let text = '';

    try {
      if (provider === 'ollama') {
        text = await fetchOllama(prompt);
      } else {
        text = await fetchGemini(prompt);
      }
    } catch (firstErr) {
      console.warn('[diagnose] primary provider failed, trying fallback', firstErr);

      // If Gemini failed and Ollama is configured, try it
      if (provider !== 'ollama' && process.env.OLLAMA_URL) {
        try {
          text = await fetchOllama(prompt);
        } catch (ollamaErr) {
          console.warn('[diagnose] Ollama fallback failed', ollamaErr);
        }
      }
    }

    // If no text was returned, use the demo fallback so the UI always works
    if (!text) {
      return NextResponse.json({
        ...getDemoResult(body),
        disclaimer:
          'This is a demo AI triage suggestion, not a medical diagnosis. Please consult a healthcare professional.',
      });
    }

    const parsed = parseAiText(text);

    return NextResponse.json({
      ...parsed,
      disclaimer:
        'This is a demo AI triage suggestion, not a medical diagnosis. Please consult a healthcare professional.',
    });
  } catch (err) {
    console.error('[diagnose]', err);
    return NextResponse.json(
      { error: 'Failed to generate diagnosis' },
      { status: 500 }
    );
  }
}
