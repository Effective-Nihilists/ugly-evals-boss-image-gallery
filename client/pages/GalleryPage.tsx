import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, Input, useApp } from 'ugly-app/client';
import type { GeneratedImage } from '../../shared/collections';

interface GalleryImage {
  _id: string;
  prompt: string;
  imageUrl: string;
  created: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket, userId } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    void socket.request('listGalleryImages', {}).then((res: { images: GalleryImage[] }) => {
      setImages(res.images);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text) return;
    setGenerating(true);
    try {
      const res = await socket.request('generateGalleryImage', { prompt: text });
      setImages((prev) => [{
        _id: res.id,
        prompt: text,
        imageUrl: res.imageUrl,
        created: Date.now(),
      }, ...prev]);
      setPrompt('');
    } catch (err) {
      console.error('[Gallery] generate failed:', err);
    } finally {
      setGenerating(false);
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
          <Text size="sm" style={{ marginBottom: 8 }}>
            Describe the image you want to create. Uses the framework&apos;s imageGen.
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              label="Prompt"
              value={prompt}
              onChange={setPrompt}
              placeholder="A sunset over a mountain lake..."
              style={{ flex: 1 }}
            />
            <Button
              onClick={() => { void handleGenerate(); }}
              disabled={generating || !prompt.trim()}
            >
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>

        <Card>
          <Text weight="medium">
            Your images {loading ? '(loading…)' : `(${images.length})`}
          </Text>
          {loading && <Text size="sm">Loading…</Text>}
          {!loading && images.length === 0 && (
            <Text size="sm">No images yet — generate one above!</Text>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            {images.map((img) => (
              <div
                key={img._id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #ddd',
                }}
              >
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                />
                <div style={{ padding: '8px 10px' }}>
                  <Text size="sm">{img.prompt}</Text>
                  <Text size="xs" style={{ opacity: 0.6, marginTop: 4 }}>
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
