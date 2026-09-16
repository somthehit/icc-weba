import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { homepageSections } from '@/db/schema';
import { DEFAULT_HOMEPAGE_BLOCKS } from '@/lib/content/homepage-layout';

export async function GET() {
  try {
    const sections = await db.select().from(homepageSections).orderBy(asc(homepageSections.displayOrder));
    return NextResponse.json({ sections: sections.length ? sections : DEFAULT_HOMEPAGE_BLOCKS });
  } catch (error) {
    console.error('Failed to load public homepage layout:', error);
    return NextResponse.json({ sections: DEFAULT_HOMEPAGE_BLOCKS });
  }
}
