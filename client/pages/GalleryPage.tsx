import React, { useEffect, useState } from 'react';
import { Button, Card, PageLayout, Text, useApp } from 'ugly-app/client';
import type { GeneratedImage } from '../../shared/collections';

export default function GalleryPage(): React.ReactElement {
  const { socket, userId } = useApp();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = socket.trackDocs<GeneratedImage>(
      'generatedImage',
      { keys: { userId } },
      (updated) => { setImages(updated); },
    );
    return unsub;
  }, [socket, userId]);

  async function handleGenerate(): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      await socket.request('generateImage', { prompt: trimmed });
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
          <Text size="sm" style={{ marginBottom: 8 }}>
            Describe the image you want to create.
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleGenerate();
              }}
              placeholder="A majestic mountain sunset..."
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
        </Card>

        <Card>
          <Text weight="medium">Your images ({images.length})</Text>
          <Text size="sm" style={{ marginBottom: 12 }}>
            Live grid via trackDocs + trackKeys. Click any image to open it.
          </Text>

          {images.length === 0 && (
            <Text size="sm">No images yet — generate one above.</Text>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {images.map((img) => (
              <div
                key={img._id}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <a href={img.imageUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={img.imageUrl}
                    alt={img.prompt}
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      display: 'block',
                      objectFit: 'cover',
                      aspectRatio: '1',
                    }}
                  />
                </a>
                <Text size="xs" style={{ color: '#666', lineHeight: 1.4 }}>
                  {img.prompt}
                </Text>
                <Text size="xs" style={{ color: '#999' }}>
                  {new Date(img.created).toLocaleString()}
                </Text>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </PageLayout>
  );
}