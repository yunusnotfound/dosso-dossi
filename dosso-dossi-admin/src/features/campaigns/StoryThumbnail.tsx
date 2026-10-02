import { useState } from 'react';
import { mediaUrl } from '../../api/client';
import type { StoryAction } from './stories';
import { validStoryImage } from './stories';

export function StoryThumbnail({ title, imageUrl, action }: { title: string; imageUrl: string; action: StoryAction }) {
  const [failedUrl, setFailedUrl] = useState('');
  const showImage = validStoryImage(imageUrl) && imageUrl !== failedUrl;
  return (
    <div className="story-ring size-24 shrink-0" aria-hidden="true">
      <div className="story-ring-inner flex h-full w-full items-center justify-center text-brand">
        {showImage ? <img className="h-full w-full object-cover" src={mediaUrl(imageUrl)} alt="" loading="lazy" onError={() => setFailedUrl(imageUrl)} /> : action === 'yukle-kazan' ? (
          <svg viewBox="0 0 48 48" className="size-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M7 20h34v9H7zM10 29v14h28V29M24 20v23M24 20c-13 0-16-13-7-13 6 0 7 13 7 13Zm0 0c13 0 16-13 7-13-6 0-7 13-7 13Z" /></svg>
        ) : action === 'kahve-ictikce' ? (
          <svg viewBox="0 0 48 48" className="size-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17h25v14a12.5 12.5 0 0 1-25 0V17ZM34 20h3a6 6 0 0 1 0 12h-3M6 44h33M16 5v5M24 5v5" /></svg>
        ) : <span className="text-3xl font-bold">{title.trim().slice(0, 1).toLocaleUpperCase('tr-TR') || '+'}</span>}
      </div>
    </div>
  );
}
