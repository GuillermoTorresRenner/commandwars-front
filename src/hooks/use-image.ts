import { useEffect, useState } from 'react';

/**
 * Carga una URL/data-URI en un HTMLImageElement para usar con react-konva
 * (<Image image={...} />). Devuelve undefined hasta que la imagen carga.
 */
export function useImage(url: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement>();

  useEffect(() => {
    const img = new window.Image();
    let cancelled = false;
    const handleLoad = () => {
      if (!cancelled) setImage(img);
    };
    img.addEventListener('load', handleLoad);
    img.src = url;
    return () => {
      cancelled = true;
      img.removeEventListener('load', handleLoad);
    };
  }, [url]);

  return image;
}
