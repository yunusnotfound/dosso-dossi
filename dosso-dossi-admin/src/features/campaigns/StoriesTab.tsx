import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui';
import { StoryDrawer } from './StoryDrawer';
import { StoryThumbnail } from './StoryThumbnail';
import { EMPTY_STORY, STORY_ACTIONS, hasBuiltInArtwork, storyInput, storyStatus, type CampaignStory, type StoryInput } from './stories';

export function StoriesTab() {
  const { admin } = useAuth();
  const canEdit = admin?.role === 'SUPER_ADMIN' || admin?.role === 'MANAGER';
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ key: string; story: StoryInput } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['campaign-stories'], queryFn: ({ signal }) => api<CampaignStory[]>('/admin/campaign-stories', { signal }), refetchInterval: 30_000 });
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: ({ signal }) => api<{ id: string; isActive: boolean }[]>('/admin/campaigns', { signal }), refetchInterval: 30_000 });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['campaign-stories'] });
  const change = useMutation({
    mutationFn: ({ story, remove }: { story: CampaignStory; remove?: boolean }) => remove
      ? api(`/admin/campaign-stories/${encodeURIComponent(story.id)}`, { method: 'DELETE' })
      : api('/admin/campaign-stories', { method: 'POST', body: { ...storyInput(story), isActive: !story.isActive } }),
    onSuccess: () => { setConfirmDelete(null); refresh(); },
  });
  const stories = [...(list.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  const statusOf = (story: CampaignStory) => {
    const status = storyStatus(story, list.dataUpdatedAt);
    const campaign = hasBuiltInArtwork(story.action) ? campaigns.data?.find((item) => item.id === story.action) : undefined;
    return status.label === 'Yayında' && campaign && !campaign.isActive ? { label: 'Kampanya kapalı', tone: 'warn' as const } : status;
  };
  const visible = stories.filter((story) => statusOf(story).label === 'Yayında');
  const edit = (story: StoryInput) => setEditing({ key: crypto.randomUUID(), story });
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><SectionTitle>Ana sayfa hikâyeleri</SectionTitle><p className="max-w-2xl text-sm text-ink-muted">Sana özel bölümünün üstünde, misafirlere ve üyelere gösterilir. Hikâyeye dokunanlar kampanyayı inceleyip seçtiğiniz sayfaya geçer. Bağlı kampanya kapatılırsa hikâye de gizlenir.</p></div>
          {canEdit ? <Button onClick={() => edit({ ...EMPTY_STORY, sortOrder: Math.min(999, (stories.at(-1)?.sortOrder ?? -1) + 1) })}>Yeni hikâye</Button> : <Badge>Salt okunur</Badge>}
        </div>
        {visible.length ? <div aria-label="Yayındaki hikâyelerin önizlemesi" className="mt-6 flex gap-5 overflow-x-auto pb-2">
          {visible.map((story) => <div key={story.id} className="flex w-24 shrink-0 flex-col items-center gap-2"><StoryThumbnail {...story} /><p className="line-clamp-2 text-center text-xs font-semibold text-ink">{story.title}</p></div>)}
        </div> : null}
      </Card>
      {list.isLoading ? <p role="status" className="text-sm text-ink-muted">Hikâyeler yükleniyor…</p> : null}
      {list.error ? <Card><p role="alert" className="text-sm text-bad">Hikâyeler yüklenemedi.</p><Button variant="ghost" onClick={() => void list.refetch()}>Yeniden dene</Button></Card> : null}
      {!list.isLoading && !list.error && !stories.length ? <EmptyState>Henüz hikâye yok. İlk kampanya hikâyenizi ekleyin.</EmptyState> : null}
      {change.error ? <p role="alert" className="text-sm text-bad">{change.error.message}</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {stories.map((story) => {
          const status = statusOf(story);
          return <Card key={story.id}>
            <article aria-label={`Hikâye: ${story.title}`} className="flex flex-col gap-4">
              <div className="flex items-center gap-4"><StoryThumbnail {...story} /><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={status.tone}>{status.label}</Badge><span className="text-xs text-ink-muted">Sıra: {story.sortOrder}</span></div><h3 className="font-bold text-ink">{story.title}</h3><p className="mt-1 text-xs text-ink-muted">{STORY_ACTIONS[story.action]}</p></div></div>
              {story.description ? <p className="line-clamp-2 text-sm text-ink-muted">{story.description}</p> : null}
              <p className="text-xs text-ink-muted">{story.startsAt ? `Başlangıç: ${new Date(story.startsAt).toLocaleString('tr-TR')}` : 'Başlangıç sınırı yok'} · {story.endsAt ? `Bitiş: ${new Date(story.endsAt).toLocaleString('tr-TR')}` : 'Süresiz'}</p>
              {canEdit ? <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Button variant="ghost" onClick={() => edit(storyInput(story))} disabled={change.isPending}>Düzenle</Button>
                <Button variant="ghost" onClick={() => change.mutate({ story })} disabled={change.isPending}>{story.isActive ? 'Yayından kaldır' : 'Yayınla'}</Button>
                {confirmDelete === story.id ? <><span className="text-xs text-ink-muted">Hikâye silinsin mi?</span><Button variant="ghost" className="text-bad" disabled={change.isPending} onClick={() => change.mutate({ story, remove: true })}>Silmeyi onayla</Button><Button variant="ghost" disabled={change.isPending} onClick={() => setConfirmDelete(null)}>Vazgeç</Button></> : <Button variant="ghost" className="text-bad" disabled={change.isPending} onClick={() => setConfirmDelete(story.id)}>Sil</Button>}
              </div> : null}
            </article>
          </Card>;
        })}
      </div>
      {editing && canEdit ? <StoryDrawer key={editing.key} initial={editing.story} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} /> : null}
    </div>
  );
}
