import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

const BUILD_DATE = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: BUILD_DATE, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified: BUILD_DATE, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
