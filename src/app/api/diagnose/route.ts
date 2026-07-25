import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    const provider = process.env.AI_PROVIDER || 'gemini';

    let text = '';
    if (provider === 'ollama') {
      const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const model = process.env.OLLAMA_MODEL || 'llama3';
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `${SYSTEM_PROMPT}\n${info}\n\nJSON response:`,
          stream: false,
          format: 'json',
        }),
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Ollama request failed' }, { status: 502 });
      }
      const data = await res.json();
      text = data.response || '';
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'GEMINI_API_KEY is not configured' },
          { status: 503 }
        );
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(
        `${SYSTEM_PROMPT}\n${info}\n\nJSON response:`
      );
      text = result.response.text();
    }

    const cleaned = text
      .replace(/```json\s?/gi, '')
      .replace(/```\s?/gi, '')
      .trim();
    const parsed = JSON.parse(cleaned);

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
