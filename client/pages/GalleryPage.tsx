import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface ImageItem {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    void (socket.request('listImages', {}) as Promise<{ images: ImageItem[] }>).then((res) => {
      setImages(res.images);
      setInitialLoading(false);
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const res = (await socket.request('generateImage', { prompt: text })) as { id: string; imageUrl: string };
      setImages((prev) => [{ id: res.id, prompt: text, imageUrl: res.imageUrl, createdAt: Date.now() }, ...prev]);
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
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <Card>
          <Text weight="medium">Generate an image</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              data-id="gallery-prompt-input"
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleGenerate();
              }}
              placeholder="Describe an image…"
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
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>

        {initialLoading && (
          <Text size="sm">Loading gallery…</Text>
        )}

        {!initialLoading && images.length === 0 && (
          <Text size="sm">No images yet — generate one above.</Text>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {images.map((img) => (
            <div
              key={img.id}
              data-id={`gallery-item-${img.id}`}
              style={{
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid #e0e0e0',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <img
                src={img.imageUrl}
                alt={img.prompt}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ padding: '8px 10px' }}>
                <Text size="sm">{img.prompt}</Text>
              </div>
            </div>
          ))}
        </div>

      </div>
    </PageLayout>
  );
}
