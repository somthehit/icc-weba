import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

const createAccountSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Account code must be at least 2 characters')
    .max(20, 'Account code cannot exceed 20 characters'),
  name: z
    .string()
    .trim()
    .min(2, 'Account name must be at least 2 characters')
    .max(160, 'Account name cannot exceed 160 characters'),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'], {
    message: 'Invalid account type',
  }),
  parentId: z.number().int().positive().optional().nullable(),
});

export const POST = withRole(['admin'], async (request: NextRequest) => {
  try {
    const parsed = await parseJson(request, createAccountSchema);
    if (!parsed.ok) return parsed.response;

    const { code, name, type, parentId } = parsed.data;

    // Check if account code already exists
    const existing = await db
      .select({ id: accounts.id, code: accounts.code })
      .from(accounts)
      .where(eq(accounts.code, code))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Account code "${code}" already exists. Please choose a unique code.` },
        { status: 400 },
      );
    }

    const [newAccount] = await db
      .insert(accounts)
      .values({
        code,
        name,
        type,
        parentId: parentId || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, account: newAccount }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account in chart of accounts' },
      { status: 500 },
    );
  }
});
