import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { pages } from '@/db/schema';

type PageProps = { params: Promise<{ slug: string }> };

async function getPublishedPage(slug: string) {
  const [page] = await db
    .select()
    .from(pages)
    .where(eq(pages.slug, slug))
    .limit(1);

  return page?.status === 'published' ? page : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getPublishedPage((await params).slug);
  if (!page) return { title: 'Page not found' };

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
  };
}

export default async function CmsPage({ params }: PageProps) {
  const page = await getPublishedPage((await params).slug);
  if (!page) notFound();

  const content = page.content as { html?: string } | null;

  return (
    <main className="min-h-screen bg-[#F4F5F8] px-4 py-10 text-slate-900 md:px-8">
      <article className="prose prose-slate mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-12 md:py-12">
        <h1>{page.title}</h1>
        {content?.html ? (
          <div dangerouslySetInnerHTML={{ __html: content.html }} />
        ) : (
          <p>This page has no published content yet.</p>
        )}
      </article>
    </main>
  );
}
