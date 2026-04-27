import React, { useEffect, useState } from 'react';
import { Button, Card, Input, PageLayout, Text, useApp } from 'ugly-app/client';

interface GalleryImageDoc {
  id: string;
  prompt: string;
  imageUrl: string;
  created: number;
}

interface ListGalleryOutput {
  images: GalleryImageDoc[];
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<GalleryImageDoc[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (socket.request as (name: string, input: unknown) => Promise<ListGalleryOutput>)('listGalleryImages', {})
      .then((res) => { setImages(res.images); })
      .catch(() => { /* ignore */ });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      await (socket.request as (name: string, input: unknown) => Promise<{ id: string }>)('generateImage', { prompt: text });
      setPrompt('');
      const res = await (socket.request as (name: string, input: unknown) => Promise<ListGalleryOutput>)('listGalleryImages', {});
      setImages(res.images);
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
          <Text weight="medium" style={{ marginBottom: 8 }}>Generate an image</Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input
                value={prompt}
                onChange={setPrompt}
                placeholder="Describe the image you want to generate..."
              />
            </div>
            <Button
              onClick={() => { void handleGenerate(); }}
              disabled={loading || !prompt.trim()}
            >
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>

        {images.length === 0 ? (
          <Card>
            <Text size="sm">No images yet — type a prompt above to generate your first one.</Text>
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {images.map((img) => (
              <Card key={img.id}>
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    borderRadius: 6,
                    display: 'block',
                  }}
                />
                <Text size="xs" style={{ marginTop: 8, wordBreak: 'break-word' }}>
                  {img.prompt}
                </Text>
                <Text size="xs" style={{ marginTop: 4, opacity: 0.6 }}>
                  {new Date(img.created).toLocaleString()}
                </Text>
              </Card>
            ))}
          </div>
        )}

      </div>
    </PageLayout>
  );
}
