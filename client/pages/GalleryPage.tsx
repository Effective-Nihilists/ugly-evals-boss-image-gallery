import React, { useEffect, useState } from 'react';
import { Button, Card, Image, PageLayout, Text, useApp } from 'ugly-app/client';

interface GalleryImage {
  id: string;
  prompt: string;
  imageUrl: string;
  created: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void socket.request('listGalleryImages', {}).then((res: unknown) => {
      const data = res as { images: GalleryImage[] };
      setImages(data.images);
      setLoading(false);
    });
  }, [socket]);

  async function handleGenerate(): Promise<void> {
    const prompt = inputPrompt.trim();
    if (!prompt || generating) return;
    setGenerating(true);
    try {
      await socket.request('generateGalleryImage', { prompt });
      setInputPrompt('');
      // Refresh the list after generating
      const refreshed = (await socket.request('listGalleryImages', {})) as { images: GalleryImage[] };
      setImages(refreshed.images);
    } catch (e) {
      console.error('Failed to generate image:', e);
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
        {/* Description */}
        <Card>
          <Text size="xl" weight="bold">AI Image Generation</Text>
          <Text size="sm" style={{ marginTop: 4 }}>
            Type a prompt to generate an image using AI. Generated images are saved to your personal gallery.
          </Text>
        </Card>

        {/* Generate input */}
        <Card>
          <Text weight="medium">Generate an image</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={inputPrompt}
              onChange={(e) => { setInputPrompt(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleGenerate();
              }}
              placeholder="Describe the image you want to create…"
              disabled={generating}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 14,
              }}
              data-id="gallery-prompt-input"
            />
            <Button
              data-id="generate-image-button"
              onClick={() => void handleGenerate()}
              disabled={!inputPrompt.trim() || generating}
            >
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>

        {/* Image grid */}
        <Card>
          <Text weight="medium">
            Your Gallery ({images.length})
          </Text>
          {loading && (
            <Text size="sm" style={{ marginTop: 8 }}>Loading your gallery…</Text>
          )}
          {!loading && images.length === 0 && (
            <Text size="sm" style={{ marginTop: 8 }}>
              No images yet — type a prompt above and generate your first one!
            </Text>
          )}
          {!loading && images.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 16,
                marginTop: 12,
              }}
              data-id="gallery-grid"
            >
              {images.map((img) => (
                <div
                  key={img.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <Image
                    src={img.imageUrl}
                    alt={img.prompt}
                    style={{ width: '100%', height: 200, objectFit: 'cover' } as React.CSSProperties}
                  />
                  <div style={{ padding: '0 8px 8px' }}>
                    <Text size="sm">{img.prompt}</Text>
                    <Text size="xs" style={{ color: '#888', marginTop: 4 }}>
                      {new Date(img.created).toLocaleString()}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
