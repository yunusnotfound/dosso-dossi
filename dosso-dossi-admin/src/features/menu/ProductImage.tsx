import { Coffee } from 'lucide-react';
import { useState } from 'react';
import { mediaUrl } from '../../api/client';

function productImageUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (candidate.startsWith('/media/')) return mediaUrl(candidate);
  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Missing or broken list artwork falls back to detail artwork, then an icon. */
export function ProductImage({
  imageUrl,
  fallbackUrl,
  className = 'size-12',
}: {
  imageUrl: string | null | undefined;
  fallbackUrl?: string | null;
  className?: string;
}) {
  const sources = [...new Set([productImageUrl(imageUrl), productImageUrl(fallbackUrl)])]
    .filter((source): source is string => source !== null);
  // A changed form value starts a fresh attempt; old failures belong only to
  // their original pair of URLs and cannot hide a replacement image.
  return <ProductImageContent key={JSON.stringify(sources)} sources={sources} className={className} />;
}

function ProductImageContent({ sources, className }: { sources: string[]; className: string }) {
  const [index, setIndex] = useState(0);
  const source = sources[index];
  return (
    <div aria-hidden="true" className={`flex shrink-0 items-center justify-center overflow-hidden rounded-chip border border-line bg-surface-sunken/50 text-ink-muted ${className}`}>
      {source ? (
        <img
          key={source}
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain p-1"
          onError={() => setIndex(index + 1)}
        />
      ) : <Coffee size={22} strokeWidth={1.5} />}
    </div>
  );
}
