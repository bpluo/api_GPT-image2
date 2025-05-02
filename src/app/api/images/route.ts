import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

const outputDir = path.resolve(process.cwd(), 'generated-images');

async function ensureOutputDirExists() {
  try {
    await fs.access(outputDir);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      try {
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
      } catch (mkdirError) {
        console.error(`Error creating output directory ${outputDir}:`, mkdirError);
        throw new Error('Failed to create image output directory.');
      }
    } else {
      console.error(`Error accessing output directory ${outputDir}:`, error);
      throw new Error(`Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export async function POST(request: NextRequest) {
  console.log('Received POST request to /api/images');

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set.');
    return NextResponse.json(
      { error: 'Server configuration error: API key not found.' },
      { status: 500 }
    );
  }

  try {
    
    let effectiveStorageMode: 'fs' | 'indexeddb';
    const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
    const isOnVercel = process.env.VERCEL === '1';

    if (explicitMode === 'fs') {
      effectiveStorageMode = 'fs';
    } else if (explicitMode === 'indexeddb') {
      effectiveStorageMode = 'indexeddb';
    } else if (isOnVercel) {
      
      effectiveStorageMode = 'indexeddb';
    } else {
      
      effectiveStorageMode = 'fs';
    }
    console.log(`Effective Image Storage Mode: ${effectiveStorageMode} (Explicit: ${explicitMode || 'unset'}, Vercel: ${isOnVercel})`);


    
    if (effectiveStorageMode === 'fs') {
      await ensureOutputDirExists();
    }

    const formData = await request.formData();
    const mode = formData.get('mode') as 'generate' | 'edit' | null;
    const prompt = formData.get('prompt') as string | null;

    console.log(`Mode: ${mode}, Prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'N/A'}`);

    if (!mode || !prompt) {
      return NextResponse.json(
        { error: 'Missing required parameters: mode and prompt' },
        { status: 400 }
      );
    }

    let result: OpenAI.Images.ImagesResponse;
    const model = 'gpt-image-1';

    if (mode === 'generate') {
      const n = parseInt(formData.get('n') as string || '1', 10);
      const size = formData.get('size') as OpenAI.Images.ImageGenerateParams['size'] || '1024x1024';
      const quality = formData.get('quality') as OpenAI.Images.ImageGenerateParams['quality'] || 'auto';
      const output_format = formData.get('output_format') as OpenAI.Images.ImageGenerateParams['output_format'] || 'png';
      const output_compression_str = formData.get('output_compression') as string | null;
      const background = formData.get('background') as OpenAI.Images.ImageGenerateParams['background'] || 'auto';
      const moderation = formData.get('moderation') as OpenAI.Images.ImageGenerateParams['moderation'] || 'auto';

      const params: OpenAI.Images.ImageGenerateParams = {
        model,
        prompt,
        n: Math.max(1, Math.min(n || 1, 10)), 
        size,
        quality,
        output_format,
        background,
        moderation,
      };

      if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
         const compression = parseInt(output_compression_str, 10);
         if (!isNaN(compression) && compression >= 0 && compression <= 100) {
            params.output_compression = compression;
         }
      }

      console.log('Calling OpenAI generate with params:', params);
      result = await openai.images.generate(params);

    } else if (mode === 'edit') {
      const n = parseInt(formData.get('n') as string || '1', 10);
      const size = formData.get('size') as OpenAI.Images.ImageEditParams['size'] || 'auto';
      const quality = formData.get('quality') as OpenAI.Images.ImageEditParams['quality'] || 'auto';

      
      const imageFiles: File[] = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('image_') && value instanceof File) {
          imageFiles.push(value);
        }
      }

      if (imageFiles.length === 0) {
        return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
      }

      const maskFile = formData.get('mask') as File | null;

      const params: OpenAI.Images.ImageEditParams = {
        model,
        prompt,
        image: imageFiles,
        n: Math.max(1, Math.min(n || 1, 10)),
        size: size === 'auto' ? undefined : size, 
        quality: quality === 'auto' ? undefined : quality, 
      };

      if (maskFile) {
        params.mask = maskFile;
      }

      console.log('Calling OpenAI edit with params:', {
          ...params,
          image: `[${imageFiles.map(f => f.name).join(', ')}]`, 
          mask: maskFile ? maskFile.name : 'N/A'
      });
      result = await openai.images.edit(params);

    } else {
      return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 });
    }

    console.log('OpenAI API call successful.');

    
    if (!result || !Array.isArray(result.data) || result.data.length === 0) {
      console.error('Invalid or empty data received from OpenAI API:', result);
      return NextResponse.json(
        { error: 'Failed to retrieve image data from API.' },
        { status: 500 }
      );
    }


    const savedImagesData = await Promise.all(
      result.data.map(async (imageData, index) => {
        if (!imageData.b64_json) {
          console.error(`Image data ${index} is missing b64_json.`);
          throw new Error(`Image data at index ${index} is missing base64 data.`);
        }
        const buffer = Buffer.from(imageData.b64_json, 'base64');
        const timestamp = Date.now();
        
        const fileExtension = formData.get('output_format') as string || 'png';
        const filename = `${timestamp}-${index}.${fileExtension}`;
        
        if (effectiveStorageMode === 'fs') {
          const filepath = path.join(outputDir, filename);
          console.log(`Attempting to save image to: ${filepath}`);
          await fs.writeFile(filepath, buffer);
          console.log(`Successfully saved image: ${filename}`);
        } else {
          
        }

        
        const imageResult: { filename: string; b64_json: string; path?: string } = {
          filename: filename,
          b64_json: imageData.b64_json, 
        };

        if (effectiveStorageMode === 'fs') {
          imageResult.path = `/generated-images/${filename}`; 
        }

        return imageResult;
      })
    );

    console.log(`All images processed. Mode: ${effectiveStorageMode}`);
    
    return NextResponse.json({ images: savedImagesData, usage: result.usage });

  } catch (error: unknown) {
    console.error('Error in /api/images:', error);

    let errorMessage = 'An unexpected error occurred.';
    let status = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
        status = error.status;
      }
    } else if (typeof error === 'object' && error !== null) {
        if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
        }
        if ('status' in error && typeof error.status === 'number') {
            status = error.status;
        }
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}