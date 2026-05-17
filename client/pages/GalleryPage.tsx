import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  PageLayout,
  Text,
  useApp,
} from 'ugly-app/client';

interface GalleryImage {
  id: string;
  prompt: string;
  imageUrl: string;
  model: string;
  createdAt: number;
}

export default function GalleryPage(): React.ReactElement {
  const { socket } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await socket.request('listImages', {}) as { images: GalleryImage[] };
      setImages(result.images);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [socket]);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  async function handleGenerate(): Promise<void> {
    const text = prompt.trim();
    if (!text) return;
    setGenerating(true);
    setError('');
    try {
      await socket.request('generateImage', { prompt: text });
      setPrompt('');
      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        {/* Generate input */}
        <Card>
          <Text weight="medium">Generate an Image</Text>
          <Text size="sm" style={{ marginBottom: 8 }}>
            Enter a prompt to generate a new AI image.
          </Text>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Prompt"
                value={prompt}
                onChange={setPrompt}
                placeholder="Describe the image you want…"
              />
            </div>
            <Button
              onClick={() => void handleGenerate()}
              disabled={generating || !prompt.trim()}
            >
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>

        {/* Error display */}
        {error && (
          <Card>
            <Text color="red" size="sm">{error}</Text>
          </Card>
        )}

        {/* Image grid */}
        <Card>
          <Text weight="medium">
            Your Images ({images.length})
          </Text>

          {loading && images.length === 0 && (
            <Text size="sm">Loading…</Text>
          )}

          {!loading && images.length === 0 && (
            <Text size="sm">No images yet — generate one above.</Text>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#fafafa',
                }}
              >
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{
                    width: '100%',
                    height: 240,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div style={{ padding: '10px 12px' }}>
                  <Text size="sm">{img.prompt}</Text>
                  <Text size="xs" style={{ color: '#888', marginTop: 4 }}>
                    {new Date(img.createdAt).toLocaleString()}
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
