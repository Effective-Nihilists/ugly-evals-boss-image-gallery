import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface GalleryImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

// ─── GalleryPage ─────────────────────────────────────────────────────────────
// Shows a grid of user's generated images with an input to generate new ones.
export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load existing images on mount
    socket.request('listImages', {}).then((response) => {
      const res = response as { images: GalleryImage[] };
      if (res?.images) {
        setImages(res.images);
      }
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    setLoading(true);
    try {
      const result = await socket.request('generateImage', { prompt: trimmedPrompt });
      const res = result as { id: string; imageUrl: string; createdAt: number };
      if (res) {
        // Add new image to the beginning of the list
        setImages([{
          id: res.id,
          prompt: trimmedPrompt,
          imageUrl: res.imageUrl,
          createdAt: res.createdAt,
        }, ...images]);
      }
    } finally {
      setLoading(false);
      setPrompt('');
    }
  }

  return (
    <PageLayout
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text weight="bold">Image Gallery</Text>
          <a href="/test" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">← Tests</Button>
          </a>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Description */}
        <Card>
          <Text size="xl" weight="bold">AI Image Gallery</Text>
          <Text size="sm" style={{ marginTop: 4 }}>
            Generate images with AI and view your collection.
          </Text>
        </Card>

        {/* Generate new image */}
        <Card>
          <Text weight="medium">Generate a new image</Text>
          <Text size="sm" style={{ marginBottom: 8 }}>
            Enter a text prompt to generate an image using AI.
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) void handleGenerate();
              }}
              placeholder="Describe the image you want..."
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
              onClick={() => void handleGenerate()}
              disabled={loading || !prompt.trim()}
            >
              {loading ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </Card>

        {/* Images grid */}
        <Card>
          <Text weight="medium">
            Your Images ({images.length})
          </Text>
          <Text size="sm" style={{ marginBottom: 12 }}>
            Click on an image to see the full prompt.
          </Text>

          {images.length === 0 && (
            <Text size="sm">No images yet — generate your first one above.</Text>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {images.map((image) => (
              <div
                key={image.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <img
                  src={image.imageUrl}
                  alt={image.prompt}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    borderRadius: 8,
                    background: '#f0f0f0',
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