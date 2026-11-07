import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { MODULE_PAGES } from '@/lib/modules';

/** The public pages, for search engines: the front page, buying, and each module's page. */
export default function sitemap(): MetadataRoute.Sitemap {
  const at = (path: string) => new URL(path, env.siteUrl).toString();
  return [
    { url: at('/'), changeFrequency: 'weekly', priority: 1 },
    { url: at('/download'), changeFrequency: 'weekly', priority: 0.9 },
    ...MODULE_PAGES.map((page) => ({ url: at(`/write/${page.slug}`), changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: at('/notes'), changeFrequency: 'monthly', priority: 0.6 },
    { url: at('/rooms'), changeFrequency: 'monthly', priority: 0.6 },
  ];
}
