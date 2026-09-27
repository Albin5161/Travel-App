import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';

/**
 * A blurred copy of a photo that survives being saved as an image.
 *
 * On a phone the image view blurs it (`blurRadius`) and a screenshot keeps that. The web's picture
 * capture ignores CSS blur, so there the blur is baked into a new small image instead: the photo is
 * drawn a few dozen pixels wide, then scaled back up with smoothing, the old downscale trick. The
 * result is a real, soft JPEG that looks the same on screen and in the saved card.
 */
export function useBlurredPhoto(source: ImageSourcePropType | null | undefined): {
  source: ImageSourcePropType | null;
  blurRadius?: number;
} {
  const [baked, setBaked] = useState<{ from: unknown; uri: string } | null>(null);
  const web = Platform.OS === 'web';

  useEffect(() => {
    if (!web || !source) return;
    let alive = true;
    const uri = uriOf(source);
    if (!uri) return;
    bake(uri)
      .then((out) => alive && out && setBaked({ from: source, uri: out }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [source, web]);

  if (!source) return { source: null };
  if (!web) return { source, blurRadius: 40 };
  // Until it's baked (or if the photo's host won't allow it): nothing, so the frost is plain.
  return baked?.from === source ? { source: { uri: baked.uri } } : { source: null };
}

function uriOf(source: ImageSourcePropType): string | null {
  if (typeof source === 'number') return Asset.fromModule(source).uri ?? null;
  if (Array.isArray(source)) return source[0]?.uri ?? null;
  return (source as { uri?: string }).uri ?? null;
}

const SMALL = 28;
const UP = 8;

async function bake(uri: string): Promise<string | null> {
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.src = uri;
  await img.decode();
  const w = SMALL;
  const h = Math.max(1, Math.round((SMALL * img.naturalHeight) / img.naturalWidth));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const s = small.getContext('2d');
  if (!s) return null;
  s.imageSmoothingQuality = 'high';
  s.drawImage(img, 0, 0, w, h);
  const big = document.createElement('canvas');
  big.width = w * UP;
  big.height = h * UP;
  const b = big.getContext('2d');
  if (!b) return null;
  b.imageSmoothingEnabled = true;
  b.imageSmoothingQuality = 'high';
  b.drawImage(small, 0, 0, big.width, big.height);
  // Throws for a photo whose host doesn't allow reading it back (CORS): the caller shows no blur.
  return big.toDataURL('image/jpeg', 0.82);
}
