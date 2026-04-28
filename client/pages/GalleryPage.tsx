import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface GalleryItem {
  id: string;
  prompt: string;
  imageUrl: string;
  created: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void socket.request('listMyImages', {}).then((res) => {
      const r = res as { images: GalleryItem[] };
      setImages(r.images);
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const p = prompt.trim();
    if (!p || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = (await socket.request('generateImage', { prompt: p })) as { id: string; imageUrl: string };
      setImages((prev) => [
        { id: res.id, prompt: p, imageUrl: res.imageUrl, created: Date.now() },
        ...prev,
      ]);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <PageLayout
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text weight="bold">Image Gallery</Text>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <Text weight="medium">Generate a new image</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              data-id="gallery-prompt-input"
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleGenerate(); }}
              placeholder="Describe the image you want…"
              disabled={generating}
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
              disabled={!prompt.trim() || generating}
            >
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
          {error && (
            <Text size="sm" style={{ marginTop: 8, color: 'red' }}>{error}</Text>
          )}
        </Card>

        <Card>
          <Text weight="medium">Your images ({images.length})</Text>
          {images.length === 0 ? (
            <Text size="sm" style={{ marginTop: 8 }}>No images yet — generate one above.</Text>
          ) : (
            <div
              data-id="gallery-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
                marginTop: 12,
              }}
            >
              {images.map((img) => (
                <div
                  key={img.id}
                  data-id="gallery-item"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: '1px solid #eee',
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.prompt}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: 6,
                      background: '#f5f5f5',
                    }}
                  />
                  <Text size="sm">{img.prompt}</Text>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
