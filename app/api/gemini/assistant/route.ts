import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_PRODUCTS } from '@/lib/data/initial-data';
import { parseJson } from '@/lib/validation/parse';
import { assistantRequestSchema } from '@/lib/validation/ai';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, assistantRequestSchema);
    if (!parsed.ok) return parsed.response;
    const { prompt, chatHistory, model } = parsed.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'The assistant is unavailable right now. Please call +977-1-4261890.' },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const catalogSummary = INITIAL_PRODUCTS.slice(0, 25).map(
      (p) => `- ${p.name} (Brand: ${p.brand}, Category: ${p.category}, Selling Price: NPR ${p.sellingPrice.toLocaleString()}, Specs: ${p.shortDescription})`
    ).join('\n');

    const systemInstruction = `You are "Intel AI Consultant", the expert technical advisor for Intel Computer & Electronics (www.intelcomputer.com.np) in New Road, Kathmandu, Nepal.

Available Catalog Highlights:
${catalogSummary}

Store Info:
- Location: New Road Plaza, Opposite Bishal Bazar, New Road, Kathmandu, Nepal.
- Phone: +977-1-4261890 / 9851034291.
- Free Valley Delivery on orders over NPR 10,000. Express courier all over Nepal.

Keep responses friendly, helpful, concise, well-structured with bullet points, and highlight exact NPR prices.`;

    const contents: any[] = [];
    for (const msg of chatHistory) {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || "I'm sorry, I couldn't process your request right now. Please call our sales team at +977-1-4261890.";

    return NextResponse.json({ text: reply });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      { error: 'The assistant could not answer that. Please try again in a moment.' },
      { status: 502 }
    );
  }
}
