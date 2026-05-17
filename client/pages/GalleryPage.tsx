import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface GalleryImage {
  _id: string;
  prompt: string;
  imageUrl: string;
  created: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadImages(): Promise<void> {
    try {
      const result = await socket.request('getMyImages', {}) as { images: GalleryImage[] };
      setImages(result.images);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void loadImages();
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);
    setError('');
    try {
      await socket.request('generateImage', { prompt: text });
      setPrompt('');
      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
          <Text size="xl" weight="bold">Generate an Image</Text>
          <Text size="sm" style={{ marginTop: 4 }}>
            Enter a prompt to generate an AI image. Generated images are saved to your gallery.
          </Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) void handleGenerate();
              }}
              placeholder="Describe the image you want to generate…"
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
            >
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
          {error && (
            <Text size="sm" style={{ color: '#d32', marginTop: 8 }}>{error}</Text>
          )}
        </Card>

        <Card>
          <Text weight="medium">
            My Images ({images.length})
          </Text>
          {images.length === 0 && (
            <Text size="sm" style={{ marginTop: 8 }}>
              No images yet — generate one above.
            </Text>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            {images.map((img) => (
              <div
                key={img._id}
                style={{
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #e0e0e0',
                  background: '#fafafa',
                }}
              >
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{
                    width: '100%',
                    height: 200,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div style={{ padding: '8px 10px' }}>
                  <Text size="sm">{img.prompt}</Text>
                  <Text size="xs" style={{ color: '#888', marginTop: 4, display: 'block' }}>
                    {new Date(img.created).toLocaleString()}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}
