"use client"; 

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ImageRecord } from "@/lib/db";
import { GenerationForm, type GenerationFormData } from "@/components/generation-form";
import { EditingForm, type EditingFormData } from "@/components/editing-form";
import { ImageOutput } from "@/components/image-output";
import { HistoryPanel } from "@/components/history-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { calculateApiCost, type CostDetails } from "@/lib/cost-utils";

type HistoryImage = {
  filename: string;
};

export type HistoryMetadata = {
  timestamp: number; 
  images: HistoryImage[];
  storageModeUsed?: 'fs' | 'indexeddb';
  durationMs: number;
  quality: GenerationFormData['quality'];
  background: GenerationFormData['background'];
  moderation: GenerationFormData['moderation'];
  prompt: string;
  mode: 'generate' | 'edit';
  costDetails: CostDetails | null;
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

const MAX_EDIT_IMAGES = 10;

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;

const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (explicitModeClient === 'fs') {
  effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
  effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {

  effectiveStorageModeClient = 'indexeddb';
} else {

  effectiveStorageModeClient = 'fs';
}
console.log(`Client Effective Storage Mode: ${effectiveStorageModeClient} (Explicit: ${explicitModeClient || 'unset'}, Vercel Env: ${vercelEnvClient || 'N/A'})`);

export default function HomePage() {
  const [mode, setMode] = React.useState<"generate" | "edit">("generate");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [latestImageBatch, setLatestImageBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
  const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
  const [history, setHistory] = React.useState<HistoryMetadata[]>([]); 
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [blobUrlCache, setBlobUrlCache] = React.useState<Record<string, string>>({});

  const allDbImages = useLiveQuery<ImageRecord[] | undefined>(
    () => effectiveStorageModeClient === 'indexeddb'
      ? db.images.toArray()
      : Promise.resolve(undefined),
    [effectiveStorageModeClient]
  );

  const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
  const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
  const [editPrompt, setEditPrompt] = React.useState("");
  const [editN, setEditN] = React.useState([1]);
  const [editSize, setEditSize] = React.useState<EditingFormData['size']>("auto");
  const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>("auto");
  const [editBrushSize, setEditBrushSize] = React.useState([20]);
  const [editShowMaskEditor, setEditShowMaskEditor] = React.useState(false);
  const [editGeneratedMaskFile, setEditGeneratedMaskFile] = React.useState<File | null>(null);
  const [editIsMaskSaved, setEditIsMaskSaved] = React.useState(false);
  const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(null);
  const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
  const [editMaskPreviewUrl, setEditMaskPreviewUrl] = React.useState<string | null>(null);


  const [genPrompt, setGenPrompt] = React.useState("");
  const [genN, setGenN] = React.useState([1]);
  const [genSize, setGenSize] = React.useState<GenerationFormData['size']>("auto");
  const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>("auto");
  const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>("png");
  const [genCompression, setGenCompression] = React.useState([100]);
  const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>("auto");
  const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>("auto");

  const getImageSrc = React.useCallback((filename: string): string | undefined => {

    if (effectiveStorageModeClient === 'indexeddb') {

      if (blobUrlCache[filename]) {
        return blobUrlCache[filename];
      }

      const record = allDbImages?.find(img => img.filename === filename);
      if (record?.blob) {

        console.log(`Creating blob URL for ${filename} from DB.`);
        const url = URL.createObjectURL(record.blob);
        setBlobUrlCache(prev => ({ ...prev, [filename]: url }));
        return url;
      }

      console.warn(`Blob not found in DB for ${filename}, falling back to FS path.`);
      return `/api/image/${filename}`;
    }

    else {

      return `/api/image/${filename}`;
    }
  }, [effectiveStorageModeClient, allDbImages, blobUrlCache]);

  React.useEffect(() => {

    return () => {
      console.log('Revoking blob URLs:', Object.keys(blobUrlCache).length);
      Object.values(blobUrlCache).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [blobUrlCache]);
  
  React.useEffect(() => {
    return () => {
      editSourceImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [editSourceImagePreviewUrls]);

  React.useEffect(() => {
    try {
      const storedHistory = localStorage.getItem("openaiImageHistory");
      if (storedHistory) {
        const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
           
           setHistory(parsedHistory);
        } else {
            console.warn("Invalid history data found in localStorage.");
            localStorage.removeItem("openaiImageHistory");
        }
      }
    } catch (e) {
      console.error("Failed to load or parse history from localStorage:", e);
      localStorage.removeItem("openaiImageHistory");
    }
    setIsInitialLoad(false);
  }, []);

  
  React.useEffect(() => {
    if (!isInitialLoad) {
        try {
            localStorage.setItem("openaiImageHistory", JSON.stringify(history));
        } catch (e) {
            console.error("Failed to save history to localStorage:", e);
        }
    }
  }, [history, isInitialLoad]);

  React.useEffect(() => {
    return () => {
      editSourceImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [editSourceImagePreviewUrls]);
  
  React.useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (mode !== 'edit' || !event.clipboardData) {
        return; 
      }

      if (editImageFiles.length >= MAX_EDIT_IMAGES) {
        alert(`Cannot paste: Maximum of ${MAX_EDIT_IMAGES} images reached.`);
        return;
      }

      const items = event.clipboardData.items;
      let imageFound = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            
            event.preventDefault();
            imageFound = true;

            const previewUrl = URL.createObjectURL(file);

            setEditImageFiles(prevFiles => [...prevFiles, file]);
            setEditSourceImagePreviewUrls(prevUrls => [...prevUrls, previewUrl]);

            console.log("Pasted image added:", file.name);

            break;
          }
        }
      }
      if (!imageFound) {
          console.log("Paste event did not contain a recognized image file.");
      }
    };

    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [mode, editImageFiles.length]);


  
  const handleApiCall = async (
    formData: GenerationFormData | EditingFormData 
  ) => {
    const startTime = Date.now();
    let durationMs = 0;

    setIsLoading(true);
    setError(null);
    setLatestImageBatch(null);
    setImageOutputView('grid');

    const apiFormData = new FormData();
    apiFormData.append("mode", mode);

    
    if (mode === "generate") {
      const genData = formData as GenerationFormData; 
      apiFormData.append("prompt", genPrompt);
      apiFormData.append("n", genN[0].toString());
      apiFormData.append("size", genSize);
      apiFormData.append("quality", genQuality);
      apiFormData.append("output_format", genOutputFormat);
      if ((genOutputFormat === 'jpeg' || genOutputFormat === 'webp') && genData.output_compression !== undefined) {
         apiFormData.append("output_compression", genData.output_compression.toString());
      }
      apiFormData.append("background", genBackground);
      apiFormData.append("moderation", genModeration);
    } else {
      apiFormData.append("prompt", editPrompt);
      apiFormData.append("n", editN[0].toString());
      apiFormData.append("size", editSize);
      apiFormData.append("quality", editQuality);

      editImageFiles.forEach((file, index) => {
        apiFormData.append(`image_${index}`, file, file.name);
      });
       if (editGeneratedMaskFile) {
         apiFormData.append("mask", editGeneratedMaskFile, editGeneratedMaskFile.name);
       }
    }

    console.log("Sending request to /api/images with mode:", mode);

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        body: apiFormData,
      });

      const result = await response.json(); 

      if (!response.ok) {
        throw new Error(result.error || `API request failed with status ${response.status}`);
      }

      console.log("API Response:", result);

      if (result.images && result.images.length > 0) {
        durationMs = Date.now() - startTime;
        console.log(`API call successful. Duration: ${durationMs}ms`);

        
        let historyQuality: GenerationFormData['quality'] = 'auto';
        let historyBackground: GenerationFormData['background'] = 'auto';
        let historyModeration: GenerationFormData['moderation'] = 'auto';
        let historyPrompt: string = ''; 

        if (mode === 'generate') {
            historyQuality = genQuality;
            historyBackground = genBackground;
            historyModeration = genModeration;
            historyPrompt = genPrompt;
        } else {
            historyQuality = editQuality;
            historyBackground = 'auto'; 
            historyModeration = 'auto'; 
            historyPrompt = editPrompt;
        }

        const costDetails = calculateApiCost(result.usage);

        const batchTimestamp = Date.now();
        const newHistoryEntry: HistoryMetadata = {
            timestamp: batchTimestamp,
            images: result.images.map((img: { filename: string }) => ({ filename: img.filename })),
            storageModeUsed: effectiveStorageModeClient,
            durationMs: durationMs,
            quality: historyQuality,
            background: historyBackground,
            moderation: historyModeration,
            prompt: historyPrompt,
            mode: mode,
            costDetails: costDetails
        };

        let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] = [];
        if (effectiveStorageModeClient === 'indexeddb') {
          console.log('Processing images for IndexedDB storage...');
          newImageBatchPromises = result.images.map(async (img: { filename: string; b64_json?: string }) => {
            if (img.b64_json) {
              try {

                const byteCharacters = atob(img.b64_json);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);

                const blob = new Blob([byteArray], { type: 'image/png' });


                await db.images.put({ filename: img.filename, blob });
                console.log(`Saved ${img.filename} to IndexedDB.`);

                const blobUrl = URL.createObjectURL(blob);
                setBlobUrlCache(prev => ({ ...prev, [img.filename]: blobUrl }));

                return { filename: img.filename, path: blobUrl };

              } catch (dbError) {
                console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                setError(`Failed to save image ${img.filename} to local database.`);
                return null;
              }
            } else {
              console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
              return null;
            }
          });
        } else {

          newImageBatchPromises = result.images
            .filter((img: { path?: string }) => !!img.path)
            .map((img: { filename: string; path: string }) => Promise.resolve({
              path: img.path,
              filename: img.filename
            }));
        }

        const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as { path: string; filename: string }[];

        setLatestImageBatch(processedImages);
        setImageOutputView(processedImages.length > 1 ? 'grid' : 0);

        setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);

      } else {
         setLatestImageBatch(null);
         throw new Error("API response did not contain valid image data or filenames.");
      }

    } catch (err: unknown) {
      durationMs = Date.now() - startTime;
      console.error(`API Call Error after ${durationMs}ms:`, err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(errorMessage);
      setLatestImageBatch(null);
    } finally {
      if (durationMs === 0) durationMs = Date.now() - startTime;
      setIsLoading(false);
    }
  };

  const handleHistorySelect = (item: HistoryMetadata) => {
    console.log(`Selecting history item from ${new Date(item.timestamp).toISOString()}`);
    const selectedBatch = item.images
      .map(img => {
        const path = getImageSrc(img.filename);
        if (path) {
          return { path, filename: img.filename };
        } else {
          console.warn(`Could not get image source for history item: ${img.filename}`);
          return null;
        }
      })
      .filter(Boolean) as { path: string; filename: string }[];

    if (selectedBatch.length !== item.images.length) {
      setError("Some images from this history entry could not be loaded (they might have been cleared from the local database).");
    } else {
      setError(null);
    }

    setLatestImageBatch(selectedBatch.length > 0 ? selectedBatch : null);
    setImageOutputView(selectedBatch.length > 1 ? 'grid' : 0);
    setError(null);
  };

  const handleClearHistory = async () => {
    const confirmationMessage = effectiveStorageModeClient === 'indexeddb'
      ? "Are you sure you want to clear the entire image history? In IndexedDB mode, this will also permanently delete all stored images. This cannot be undone."
      : "Are you sure you want to clear the entire image history? This cannot be undone.";

    if (window.confirm(confirmationMessage)) {
      setHistory([]);
      setLatestImageBatch(null);
      setImageOutputView('grid');
      setError(null);

      try {

        localStorage.removeItem("openaiImageHistory");
        console.log("Cleared history metadata from localStorage.");

        if (effectiveStorageModeClient === 'indexeddb') {
          await db.images.clear();
          console.log("Cleared images from IndexedDB.");

          setBlobUrlCache({});
        }
      } catch (e) {
        console.error("Failed during history clearing:", e);
        setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  const handleSendToEdit = async (filename: string) => {
    if (isSendingToEdit) return;
    setIsSendingToEdit(true);
    setError(null);

    const alreadyExists = editImageFiles.some(file => file.name === filename);
    if (mode === 'edit' && alreadyExists) {
      console.log(`Image ${filename} already in edit list.`);
      setIsSendingToEdit(false);
      return;
    }

    if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
      setError(`Cannot add more than ${MAX_EDIT_IMAGES} images to the edit form.`);
      setIsSendingToEdit(false);
      return;
    }

    console.log(`Sending image ${filename} to edit...`);

    try {
      let blob: Blob | undefined;
      let mimeType: string = 'image/png';

      if (effectiveStorageModeClient === 'indexeddb') {
        console.log(`Fetching blob ${filename} from IndexedDB...`);

        const record = allDbImages?.find(img => img.filename === filename);
        if (record?.blob) {
          blob = record.blob;
          mimeType = blob.type || mimeType;
          console.log(`Found blob ${filename} in IndexedDB.`);
        } else {
          throw new Error(`Image ${filename} not found in local database.`);
        }
      } else {

        console.log(`Fetching image ${filename} from API...`);
        const response = await fetch(`/api/image/${filename}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        blob = await response.blob();
        mimeType = response.headers.get('Content-Type') || mimeType;
        console.log(`Fetched image ${filename} from API.`);
      }

      if (!blob) {
        throw new Error(`Could not retrieve image data for ${filename}.`);
      }


      const newFile = new File([blob], filename, { type: mimeType });
      const newPreviewUrl = URL.createObjectURL(blob);

      editSourceImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));

      setEditImageFiles([newFile]);
      setEditSourceImagePreviewUrls([newPreviewUrl]);

      if (mode === 'generate') {
        setMode('edit');
      }

      console.log(`Successfully set ${filename} in edit form.`);

    } catch (err: unknown) {
      console.error("Error sending image to edit:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send image to edit form.";
      setError(errorMessage);
    } finally {
      setIsSendingToEdit(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12 bg-black text-white">
      <div className="w-full max-w-7xl space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col h-[70vh] min-h-[600px] lg:col-span-1 relative">
             <div className={mode === 'generate' ? 'block w-full h-full' : 'hidden'}>
                <GenerationForm
                  onSubmit={handleApiCall}
                  isLoading={isLoading}
                  currentMode={mode}
                  onModeChange={setMode}
                  prompt={genPrompt}
                  setPrompt={setGenPrompt}
                  n={genN}
                  setN={setGenN}
                  size={genSize}
                  setSize={setGenSize}
                  quality={genQuality}
                  setQuality={setGenQuality}
                  outputFormat={genOutputFormat}
                  setOutputFormat={setGenOutputFormat}
                  compression={genCompression}
                  setCompression={setGenCompression}
                  background={genBackground}
                  setBackground={setGenBackground}
                  moderation={genModeration}
                  setModeration={setGenModeration}
                />
             </div>
             <div className={mode === 'edit' ? 'block w-full h-full' : 'hidden'}>
                <EditingForm
                  onSubmit={handleApiCall}
                  isLoading={isLoading || isSendingToEdit}
                  currentMode={mode}
                  onModeChange={setMode}
                  imageFiles={editImageFiles}
                  sourceImagePreviewUrls={editSourceImagePreviewUrls}
                  setImageFiles={setEditImageFiles}
                  setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                  maxImages={MAX_EDIT_IMAGES}
                  editPrompt={editPrompt}
                  setEditPrompt={setEditPrompt}
                  editN={editN}
                  setEditN={setEditN}
                  editSize={editSize}
                  setEditSize={setEditSize}
                  editQuality={editQuality}
                  setEditQuality={setEditQuality}
                  editBrushSize={editBrushSize}
                  setEditBrushSize={setEditBrushSize}
                  editShowMaskEditor={editShowMaskEditor}
                  setEditShowMaskEditor={setEditShowMaskEditor}
                  editGeneratedMaskFile={editGeneratedMaskFile}
                  setEditGeneratedMaskFile={setEditGeneratedMaskFile}
                  editIsMaskSaved={editIsMaskSaved}
                  setEditIsMaskSaved={setEditIsMaskSaved}
                  editOriginalImageSize={editOriginalImageSize}
                  setEditOriginalImageSize={setEditOriginalImageSize}
                  editDrawnPoints={editDrawnPoints}
                  setEditDrawnPoints={setEditDrawnPoints}
                  editMaskPreviewUrl={editMaskPreviewUrl}
                  setEditMaskPreviewUrl={setEditMaskPreviewUrl}
                />
             </div>
          </div>
          <div className="flex flex-col h-[70vh] min-h-[600px] lg:col-span-1">
            {error && (
                <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-900/20 text-red-300">
                    <AlertTitle className="text-red-200">Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            <ImageOutput
               imageBatch={latestImageBatch}
               viewMode={imageOutputView}
               onViewChange={setImageOutputView}
               altText="Generated image output"
               isLoading={isLoading || isSendingToEdit}
               onSendToEdit={handleSendToEdit}
               currentMode={mode}
               baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
            />
          </div>
        </div>

        <div className="min-h-[450px]">
          <HistoryPanel
            history={history}
            onSelectImage={handleHistorySelect}
            onClearHistory={handleClearHistory}
            getImageSrc={getImageSrc}
          />
        </div>
      </div>
    </main>
  );
}
