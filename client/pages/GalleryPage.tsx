import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';

interface GalleryImageItem {
  id: string;
  prompt: string;
  imageUrl: string;
  created: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<GalleryImageItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void socket.request('listGalleryImages', {}).then((result) => {
      setImages((result as { images: GalleryImageItem[] }).images);
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text) return;
    setGenerating(true);
    try {
      const result = (await socket.request('generateGalleryImage', { prompt: text })) as { id: string; imageUrl: string };
      setImages((prev) => [
        { id: result.id, prompt: text, imageUrl: result.imageUrl, created: Date.now() },
        ...prev,
      ]);
      setPrompt('');
    } finally {
      setGenerating(false);
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
          <Text size="xl" weight="bold">AI Image Gallery</Text>
          <Text size="sm" style={{ marginTop: 4 }}>
            Enter a prompt to generate an image. Your creations appear below.
          </Text>
        </Card>

        <Card>
          <Text weight="medium">Generate an image</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              data-id="gallery-prompt-input"
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !generating) void handleGenerate();
              }}
              placeholder="Describe the image you want..."
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
              onClick={() => { void handleGenerate(); }}
              disabled={!prompt.trim() || generating}
            >
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>

        <Card>
          <Text weight="medium">Your Images ({images.length})</Text>
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
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #e0e0e0',
                  background: '#fafafa',
                }}
              >
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  loading="lazy"
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                />
                <div style={{ padding: '8px 10px' }}>
                  <Text size="sm" style={{ lineHeight: 1.3 }}>{img.prompt}</Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}
