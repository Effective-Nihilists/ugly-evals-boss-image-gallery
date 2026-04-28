import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface ImageEntry {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void socket.request('listImages', {}).then((res: unknown) => {
      const data = res as { images: ImageEntry[] };
      setImages(data.images);
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);
    try {
      const res = await socket.request('generateImage', { prompt: text }) as { id: string; imageUrl: string };
      setImages((prev) => [
        { id: res.id, prompt: text, imageUrl: res.imageUrl, createdAt: Date.now() },
        ...prev,
      ]);
      setPrompt('');
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
        <Card>
          <Text weight="medium">Generate an Image</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              data-id="gallery-prompt-input"
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) void handleGenerate();
              }}
              placeholder="Describe an image..."
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
              data-id="gallery-generate-btn"
              onClick={() => { void handleGenerate(); }}
              disabled={!prompt.trim() || loading}
            >
              {loading ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </Card>

        <Card>
          <Text weight="medium">Your Images ({images.length})</Text>
          {images.length === 0 && (
            <Text size="sm" style={{ marginTop: 8 }}>No images yet — generate one above.</Text>
          )}
          <div
            data-id="gallery-grid"
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
                data-id={`gallery-image-${img.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #e0e0e0',
                  background: '#fafafa',
                }}
              >
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                />
                <div style={{ padding: 8 }}>
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
