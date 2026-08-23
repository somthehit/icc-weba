import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_PRODUCTS } from '@/lib/data/initial-data';
import { parseJson } from '@/lib/validation/parse';
import { chatRequestSchema } from '@/lib/validation/ai';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, chatRequestSchema);
    if (!parsed.ok) return parsed.response;
    const {
      prompt,
      chatHistory,
      model: selectedModel,
      role,
      enableMapsGrounding,
      userLocation,
    } = parsed.data;

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

    // Role-specific System Instructions
    let roleDescription = '';
    if (role === 'pc_architect') {
      roleDescription = `You are the "Master PC Hardware Architect & Overclocking Engineer" at Intel Computer & Electronics, Kathmandu.
Your expertise: Custom PC builds (Gaming rigs, CAD/3D render workstations, Deep Learning rigs, Video editing PCs), bottleneck diagnostics, TDP power budget calculations, motherboard VRM analysis, DDR4 vs DDR5 timing, and liquid cooling setups.`;
    } else if (role === 'repair_cctv_tech') {
      roleDescription = `You are the "Senior CCTV & Hardware Diagnostics Technician" at Intel Computer & Electronics, Kathmandu.
Your expertise: Hikvision & Dahua IP camera network configuration, NVR/DVR storage calculations (TB required per month), laptop chip-level motherboard repair, Epson/Canon printer head cleaning & ink line troubleshooting, and data recovery services.`;
    } else if (role === 'local_guide') {
      roleDescription = `You are the "Kathmandu Tech Navigator & Store Delivery Specialist" at Intel Computer & Electronics.
Your expertise: Providing precise directions to Intel Computer's flagship showroom at New Road Plaza (Opposite Bishal Bazar), Kathmandu Valley same-day express delivery, courier coverage across 77 districts in Nepal, payment options (eSewa, Khalti, Fonepay, Bank Transfer, COD), and official VAT invoice procedures.`;
    } else {
      roleDescription = `You are the "Chief Tech Consultant & Hardware Advisor" for Intel Computer & Electronics (www.intelcomputer.com.np) in New Road, Kathmandu, Nepal.
Your expertise: Recommending laptops, monitors, accessories, home & office tech, offering honest side-by-side product comparisons, and explaining official manufacturer warranty coverage in Nepal.`;
    }

    const catalogSummary = INITIAL_PRODUCTS.slice(0, 30).map(
      (p) => `- ${p.name} | Category: ${p.category} | Price: NPR ${p.sellingPrice.toLocaleString()} | Key Features: ${p.shortDescription}`
    ).join('\n');

    const systemInstruction = `${roleDescription}

Store Context:
- Store Name: Intel Computer & Electronics (Remix)
- Address: New Road Plaza, 2nd Floor, Opposite Bishal Bazar, New Road, Kathmandu, Nepal
- Landline: +977-1-4261890 | Mobile / WhatsApp: +977-9851034291 / +977-9851084291
- Warranty: 1 to 3 Years official distributor warranty with free labor service at our Kathmandu repair lab.
- Delivery: Free inside Kathmandu Valley (Ring Road & surrounding) on orders above NPR 10,000. 24-48 hr courier to Pokhara, Butwal, Biratnagar, Chitwan, Dharan, Nepalgunj, Dhangadhi, and all districts.

In-Stock Highlight Catalog:
${catalogSummary}

Guidelines:
1. Be polite, professional, and technically authoritative. Format responses with clean Markdown, bullet points, and highlight exact NPR prices.
2. If the user mentions locations or asks for nearby stores / directions, clearly state physical landmarks in New Road Kathmandu.
3. Keep answers directly actionable.`;

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

    const config: any = {
      systemInstruction,
    };

    // If Maps Grounding is enabled or requested
    if (enableMapsGrounding && selectedModel === 'gemini-3.5-flash') {
      config.tools = [{ googleMaps: {} }];
      const lat = userLocation?.lat ?? 27.700769;
      const lng = userLocation?.lng ?? 85.312950;
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng,
          },
        },
      };
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config,
    });

    const text = response.text || "I'm here to assist you with your tech requirements at Intel Computer Kathmandu.";

    // Extract Maps Grounding URLs if present
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const mapLinks: Array<{ title: string; uri: string }> = [];

    if (Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks as any[]) {
        if (chunk.maps?.uri) {
          mapLinks.push({
            title: chunk.maps.title || 'Google Maps Location',
            uri: chunk.maps.uri,
          });
        }
      }
    }

    return NextResponse.json({
      text,
      model: selectedModel,
      role,
      mapLinks: mapLinks.length > 0 ? mapLinks : undefined,
    });
  } catch (error) {
    // The provider's message can carry request detail we don't want to hand a
    // visitor; it goes to the log, not the response.
    console.error('Gemini Chat API Error:', error);
    return NextResponse.json(
      { error: 'The assistant could not answer that. Please try again in a moment.' },
      { status: 502 }
    );
  }
}
