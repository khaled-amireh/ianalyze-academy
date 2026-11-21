import { safeLinks, type SessionTopic } from './domain.ts';

export type PublicSessionTopic = Pick<
  SessionTopic,
  'id' | 'title_en' | 'title_ar' | 'description' | 'links' | 'status'
>;

export function parsePublicSessionTopics(value: unknown): PublicSessionTopic[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const topics: PublicSessionTopic[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const topic = item as Record<string, unknown>;
    if (
      typeof topic.id !== 'string' ||
      topic.id.length < 1 ||
      topic.id.length > 100 ||
      ids.has(topic.id) ||
      typeof topic.title_en !== 'string' ||
      topic.title_en.trim().length < 1 ||
      topic.title_en.length > 200 ||
      typeof topic.title_ar !== 'string' ||
      topic.title_ar.trim().length < 1 ||
      topic.title_ar.length > 200 ||
      typeof topic.description !== 'string' ||
      topic.description.length > 10000 ||
      typeof topic.links !== 'string' ||
      topic.links.length > 5000 ||
      !safeLinks(topic.links) ||
      (topic.status !== 'planned' && topic.status !== 'completed')
    )
      return null;
    ids.add(topic.id);
    topics.push({
      id: topic.id,
      title_en: topic.title_en,
      title_ar: topic.title_ar,
      description: topic.description,
      links: topic.links,
      status: topic.status,
    });
  }
  return topics;
}
