import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async (context) => {
  const entries = (await getCollection('changelog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );

  return rss({
    title: 'Fimil Changelog',
    description:
      'What has shipped in Fimil: scanners, the AI pentest engine, auto-remediation, and platform updates.',
    site: context.site!,
    trailingSlash: false,
    items: entries.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.date,
      link: `/changelog#${entry.id}`,
      categories: [entry.data.category],
    })),
    customData: '<language>en-us</language>',
  });
};
