import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface ImageRecord {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void socket.request('listImages', {}).then((res) => {
      const typed = res as { images: ImageRecord[] };
      setImages(typed.images);
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await socket.request('generateImage', { prompt: text }) as { id: string; imageUrl: string };
      setImages((prev) => [{ id: res.id, prompt: text, imageUrl: res.imageUrl, createdAt: Date.now() }, ...prev]);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate image');
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
          <Text size="xl" weight="bold">Generate an Image</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleGenerate(); }}
              placeholder="Describe the image you want…"
              disabled={generating}
              data-id="gallery-prompt-input"
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
              disabled={!prompt.trim() || generating}
              data-id="gallery-generate-button"
            >
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
          {error && (
            <Text size="sm" style={{ color: 'red', marginTop: 8 }}>{error}</Text>
          )}
        </Card>

        {images.length === 0 && !generating && (
          <Card>
            <Text size="sm">No images yet — generate one above.</Text>
          </Card>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {images.map((img) => (
            <Card key={img.id} style={{ padding: 0, overflow: 'hidden' }}>
              <img
                src={img.imageUrl}
                alt={img.prompt}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ padding: '8px 12px 12px' }}>
                <Text size="sm">{img.prompt}</Text>
                <Text size="sm" style={{ color: '#888', marginTop: 4 }}>
                  {new Date(img.createdAt).toLocaleString()}
                </Text>
              </div>
            </Card>
          ))}
        </div>

      </div>
    </PageLayout>
  );
}
