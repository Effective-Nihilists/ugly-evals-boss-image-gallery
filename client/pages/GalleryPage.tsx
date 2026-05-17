import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface GalleryImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

// ─── GalleryPage ─────────────────────────────────────────────────────────────
// Displays a grid of the user's previously generated images with an input to generate new ones.
export default function GalleryPage(): React.ReactElement {
  const { socket, userId } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    // Load user's existing images on mount
    socket.request('listMyImages', {}).then((response) => {
      const res = response as { images: GalleryImage[] };
      if (res?.images) {
        setImages(res.images);
      }
    });
  }, [socket, userId]);

  async function handleGenerate(): Promise<void> {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    setLoading(true);
    try {
      const result = await socket.request('generateImage', { prompt: trimmedPrompt });
      const img = result as GalleryImage;
      if (img?.id) {
        setImages((prev) => [img, ...prev]);
        setPrompt('');
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text weight="bold">Image Gallery</Text>
          <a href="/" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">← Home</Button>
          </a>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Generate new image */}
        <Card>
          <Text weight="medium">Generate a new image</Text>
          <Text size="sm" style={{ marginBottom: 8 }}>
            Enter a text prompt and the AI will create an image for you.
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="A prompt describing the image you want..."
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPrompt(e.target.value); }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter' && !loading) {
                  void handleGenerate();
                }
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 14,
              }}
            />
            <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
              {loading ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </Card>

        {/* Gallery grid */}
        {images.length === 0 ? (
          <Card>
            <Text size="sm">No images yet. Generate your first image above!</Text>
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {images.map((img) => (
              <Card key={img.id}>
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 4 }}
                />
                <Text size="sm" style={{ marginTop: 8 }}>
                  {img.prompt}
                </Text>
                <Text size="xs" color="secondary" style={{ marginTop: 4 }}>
                  {new Date(img.createdAt).toLocaleString()}
                </Text>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}