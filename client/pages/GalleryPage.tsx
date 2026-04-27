import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';
import type { AppSocket } from 'ugly-app/client';
import type { AppRegistry } from '../../shared/api';

interface ImageEntry {
  id: string;
  prompt: string;
  imageUrl: string;
  created: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket: rawSocket } = useApp();
  const socket = rawSocket as AppSocket<AppRegistry>;
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void socket.request('listImages', {}).then((res) => {
      if (res?.images) setImages(res.images);
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const res = await socket.request('generateImage', { prompt: text });
      if (res?.id) {
        setImages((prev) => [
          { id: res.id, prompt: text, imageUrl: res.imageUrl, created: Date.now() },
          ...prev,
        ]);
        setPrompt('');
      }
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

        {/* Generate new image */}
        <Card>
          <Text weight="medium">Generate an image</Text>
          <Text size="sm" style={{ marginBottom: 8 }}>
            Describe what you want to see — the AI will create it.
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              data-id="gallery-prompt-input"
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleGenerate();
              }}
              placeholder="A serene mountain landscape at sunset..."
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

        {/* Gallery grid */}
        <Card>
          <Text weight="medium">Your images ({images.length})</Text>
          <Text size="sm" style={{ marginBottom: 12 }}>
            Click an image to open it in a new tab.
          </Text>

          {images.length === 0 && (
            <Text size="sm">No images yet — generate one above.</Text>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {images.map((img) => (
              <div key={img.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <a
                  href={img.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-id={`gallery-image-${img.id}`}
                  style={{ display: 'block', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', textDecoration: 'none' }}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.prompt}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                </a>
                <Text size="xs" style={{ color: '#666', lineHeight: 1.4 }}>
                  {img.prompt}
                </Text>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </PageLayout>
  );
}
