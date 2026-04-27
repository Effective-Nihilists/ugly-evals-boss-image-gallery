import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface GalleryImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadImages(): Promise<void> {
    const result = await socket.request('listGeneratedImages', {}) as { images: GalleryImage[] };
    setImages(result.images);
  }

  useEffect(() => {
    void loadImages();
  }, []);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);
    try {
      await socket.request('generateImage', { prompt: text });
      setPrompt('');
      await loadImages();
    } finally {
      setLoading(false);
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
        <Card>
          <Text weight="medium">Generate an image</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleGenerate();
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
              disabled={!prompt.trim() || loading}
              data-id="generate-image"
            >
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>

        <Card>
          <Text weight="medium">Your images ({images.length})</Text>
          {images.length === 0 && (
            <Text size="sm" style={{ marginTop: 8 }}>
              No images yet — generate one above.
            </Text>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #e5e5e5',
                }}
              >
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div style={{ padding: '0 8px 8px' }}>
                  <Text size="sm">{img.prompt}</Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}
