import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';
import type { GeneratedImage } from '../../shared/collections';

// DB object type (includes _id, version, etc.) for trackDocs
type DbImage = GeneratedImage & { _id: string };

// API response type (without DB fields)
interface GalleryImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

// ─── GalleryPage ─────────────────────────────────────────────────────────────────
// Displays a grid of AI-generated images with prompts, and an input to generate new ones.
export default function GalleryPage(): React.ReactElement {
  const { socket, userId } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  // Load images on mount
  useEffect(() => {
    socket.request('listImages', {}).then((result: unknown) => {
      const data = result as { images: GalleryImage[] };
      setImages(data.images);
    }).catch((e: unknown) => {
      console.error('Failed to load images:', e);
    });
  }, [socket]);

  // Subscribe to real-time updates via trackDocs
  useEffect(() => {
    const unsub = socket.trackDocs<DbImage>(
      'generatedImage',
      { keys: { userId } },
      (updated) => {
        // Convert tracked docs to the same format as listImages
        const formatted = updated.map((doc) => ({
          id: doc._id,
          prompt: doc.prompt,
          imageUrl: doc.imageUrl,
          createdAt: doc.createdAt,
        }));
        setImages(formatted);
      },
    );
    return unsub;
  }, [socket, userId]);

  async function handleGenerate(): Promise<void> {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || loading) return;

    setLoading(true);
    try {
      await socket.request('generateImage', { prompt: trimmedPrompt });
      setPrompt('');
    } catch (e) {
      console.error('Failed to generate image:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text weight="bold">AI Image Gallery</Text>
          <a href="/" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">← Home</Button>
          </a>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Description */}
        <Card>
          <Text size="xl" weight="bold">Generate & Collect AI Images</Text>
          <Text size="sm" style={{ marginTop: 4 }}>
            Enter a prompt to generate an image. Your generated images appear in the gallery below.
          </Text>
        </Card>

        {/* Generate input */}
        <Card>
          <Text weight="medium">Generate a new image</Text>
          <Text size="sm" style={{ marginBottom: 8 }}>
            Calls <strong>socket.request('generateImage', {'{ prompt }'})</strong> — generates an image using AI
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              data-id="gallery-prompt-input"
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleGenerate();
              }}
              placeholder="Describe the image you want to generate..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 14,
              }}
            />
            <Button
              data-id="gallery-generate-button"
              onClick={() => void handleGenerate()}
              disabled={!prompt.trim() || loading}
            >
              {loading ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </Card>

        {/* Gallery grid */}
        <Card>
          <Text weight="medium">
            Your Gallery ({images.length} images)
          </Text>
          <Text size="sm" style={{ marginBottom: 12 }}>
            Images are stored in the <strong>generatedImage</strong> collection and update in real-time.
          </Text>

          {images.length === 0 && (
            <Text size="sm">No images yet — generate one above!</Text>
          )}

          <div
            data-id="gallery-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {images.map((image) => (
              <div
                key={image.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 12,
                  background: 'rgba(0,0,0,0.03)',
                  borderRadius: 8,
                }}
              >
                <img
                  src={image.imageUrl}
                  alt={image.prompt}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    borderRadius: 6,
                    background: '#eee',
                  }}
                />
                <Text size="xs" style={{ wordBreak: 'break-word' }}>
                  {image.prompt}
                </Text>
                <Text size="xs" color="secondary">
                  {new Date(image.createdAt).toLocaleString()}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}