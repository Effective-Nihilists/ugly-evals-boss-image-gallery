import React, { useEffect, useState } from 'react';
import { Button, Card, Input, PageLayout, Text, useApp } from 'ugly-app/client';

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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void socket.request('listGeneratedImages', {}).then((result) => {
      const { images: imgs } = result as { images: ImageEntry[] };
      setImages(imgs);
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const { id, imageUrl } = await socket.request('generateImage', { prompt: text }) as { id: string; imageUrl: string };
      const entry: ImageEntry = { id, prompt: text, imageUrl, createdAt: Date.now() };
      setImages((prev) => [entry, ...prev]);
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        <Card>
          <Text weight="medium" style={{ marginBottom: 8 }}>Generate a new image</Text>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label=""
                value={prompt}
                onChange={setPrompt}
                placeholder="Describe an image…"
              />
            </div>
            <Button
              data-id="generate-image"
              onClick={() => { void handleGenerate(); }}
              disabled={!prompt.trim() || generating}
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
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
                <Text size="sm" style={{ wordBreak: 'break-word' }}>{img.prompt}</Text>
              </div>
            </Card>
          ))}
        </div>

      </div>
    </PageLayout>
  );
}
