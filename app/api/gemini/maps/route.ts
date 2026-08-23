import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { parseJson } from '@/lib/validation/parse';
import { mapsRequestSchema } from '@/lib/validation/ai';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, mapsRequestSchema);
    if (!parsed.ok) return parsed.response;
    const { query, latitude, longitude } = parsed.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Location search is unavailable right now. Please call +977-1-4261890.' },
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

    const userPrompt = query || `Locate electronics stores, computer repair labs, and tech markets around New Road, Bishal Bazar, and Kathmandu Valley Nepal. Mention exact landmarks, approximate distances, and contact guidelines.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: `You are the Official Geospatial & Local Directory Assistant for Intel Computer & Electronics (Remix Intel), located at New Road Plaza, Opposite Bishal Bazar, New Road, Kathmandu, Nepal. Provide accurate location details, directions, landmarks, nearby parking areas, and transit routes across Kathmandu Valley and Nepal. When mentioning places, be precise.`,
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude,
              longitude,
            },
          },
        },
      },
    });

    const text = response.text || '';
    
    // Extract Grounding Chunks & Map Links
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    
    const places: Array<{
      title: string;
      uri: string;
      sourceSnippet?: string;
    }> = [];

    if (Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks as any[]) {
        if (chunk.maps?.uri) {
          places.push({
            title: chunk.maps.title || 'Location on Google Maps',
            uri: chunk.maps.uri,
            sourceSnippet: chunk.maps.placeAnswerSources?.reviewSnippets?.[0] || undefined,
          });
        }
      }
    }

    return NextResponse.json({
      text,
      places,
      groundingMetadata: groundingMetadata ? {
        webSearchQueries: groundingMetadata.webSearchQueries,
        searchEntryPoint: groundingMetadata.searchEntryPoint,
      } : undefined,
    });
  } catch (error) {
    console.error('Gemini Maps Grounding API Error:', error);
    return NextResponse.json(
      { error: 'Could not look that up right now. Please try again in a moment.' },
      { status: 502 }
    );
  }
}
