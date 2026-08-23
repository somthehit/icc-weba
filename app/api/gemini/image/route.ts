import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { imageRequestSchema } from '@/lib/validation/ai';

/**
 * Image generation, for the staff AI studio.
 *
 * Staff-only on purpose: this is the most expensive call on the shop's Gemini
 * key, it accepts an uploaded image, and no storefront screen uses it. If the
 * studio is ever opened to customers, swap `withAdmin` for a plain handler —
 * the middleware already treats `/api/gemini` as public.
 */
export const POST = withAdmin(async (req) => {
  try {
    const parsed = await parseJson(req, imageRequestSchema);
    if (!parsed.ok) return parsed.response;
    const {
      prompt,
      baseImage,
      mimeType,
      aspectRatio: selectedRatio,
      imageSize,
      stylePreset,
    } = parsed.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Image generation is unavailable: GEMINI_API_KEY is not configured.' },
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

    let enhancedPrompt = prompt;
    if (stylePreset === 'hardware_studio') {
      enhancedPrompt = `Professional product photography, studio hardware lighting, ultra-clean commercial aesthetic, 8k resolution, crisp detail: ${prompt}`;
    } else if (stylePreset === 'cyberpunk_rgb') {
      enhancedPrompt = `Futuristic high-end cyberpunk gaming rig aesthetic, vibrant RGB neon glows, dark aluminum chassis, glowing liquid cooling tubes, ultra-detailed: ${prompt}`;
    } else if (stylePreset === 'minimalist_desk') {
      enhancedPrompt = `Minimalist modern ergonomic tech workstation, natural soft ambient daylight, clean cable management, Scandinavian wood desk: ${prompt}`;
    } else if (stylePreset === 'blueprint_schematic') {
      enhancedPrompt = `Engineering schematic blueprint diagram, technical architectural drawing, vector component annotations, dark blue blueprint: ${prompt}`;
    }

    let parts: any[] = [];

    // If an existing image was uploaded/passed for image editing:
    if (baseImage) {
      // Clean base64 string if it contains data URI header
      const cleanedBase64 = baseImage.replace(/^data:image\/[a-z]+;base64,/, '');
      parts = [
        {
          inlineData: {
            data: cleanedBase64,
            mimeType,
          },
        },
        {
          text: `Edit this image according to the following instructions: ${enhancedPrompt}`,
        },
      ];
    } else {
      // Pure text-to-image creation
      parts = [
        {
          text: enhancedPrompt,
        },
      ];
    }

    // Use gemini-3.1-flash-image with fallback to gemini-3.1-flash-lite-image
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
          parts,
        },
        config: {
          imageConfig: {
            aspectRatio: selectedRatio,
            imageSize,
          },
        },
      });
    } catch (primaryErr) {
      console.warn('gemini-3.1-flash-image attempt failed, trying gemini-3.1-flash-lite-image:', primaryErr);
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts,
        },
      });
    }

    let generatedImageUrl: string | null = null;
    let textDescription = '';

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          const partMime = part.inlineData.mimeType || 'image/png';
          generatedImageUrl = `data:${partMime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textDescription += part.text + ' ';
        }
      }
    }

    if (!generatedImageUrl) {
      return NextResponse.json(
        { 
          error: 'Image generation completed without returning an image payload. Please refine your prompt.',
          text: textDescription.trim() 
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      imageUrl: generatedImageUrl,
      prompt: enhancedPrompt,
      originalPrompt: prompt,
      aspectRatio: selectedRatio,
      description: textDescription.trim(),
    });
  } catch (error) {
    console.error('Gemini Image API Error:', error);
    return NextResponse.json(
      { error: 'Image generation failed. Please try again in a moment.' },
      { status: 502 }
    );
  }
});
