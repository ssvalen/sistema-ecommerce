import { faImage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { cx } from '@/shared/lib/cx';

interface ProductImageProps {
  src: string | null;
  /** Vacío si el texto ya nombra el producto. */
  alt: string;
  className?: string;
  /** Imagen principal de la página. */
  priority?: boolean;
}

export function ProductImage({ src, alt, className, priority = false }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        className={cx('flex items-center justify-center bg-slate-100 text-slate-300', className)}
      >
        <FontAwesomeIcon icon={faImage} className="text-3xl" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cx('bg-slate-100 object-cover', className)}
    />
  );
}
