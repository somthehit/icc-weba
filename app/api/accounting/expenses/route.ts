import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { expenses, expenseCategories, suppliers } from '@/db/schema/accounting';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const list = await db
      .select({
        id: expenses.id,
        categoryId: expenses.categoryId,
        supplierId: expenses.supplierId,
        description: expenses.description,
        amount: expenses.amount,
        vatAmount: expenses.vatAmount,
        expenseDate: expenses.expenseDate,
        paymentMethod: expenses.paymentMethod,
        referenceNo: expenses.referenceNo,
        createdAt: expenses.createdAt,
        categoryName: expenseCategories.name,
        supplierName: suppliers.name,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
      .leftJoin(suppliers, eq(suppliers.id, expenses.supplierId))
      .orderBy(desc(expenses.expenseDate), desc(expenses.id))
      .limit(100);

    const categories = await db.select().from(expenseCategories).where(eq(expenseCategories.isActive, true));

    return NextResponse.json({
      success: true,
      expenses: list,
      categories,
    });
  } catch (error: any) {
    console.error('Expenses API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch expenses',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId, supplierId, description, amount, vatAmount, expenseDate, paymentMethod, referenceNo } = body;

    if (!description || !amount) {
      return NextResponse.json({ success: false, error: 'Description and amount are required' }, { status: 400 });
    }

    // Default category fallback if none provided
    let finalCategoryId = Number(categoryId);
    if (!finalCategoryId) {
      const [firstCat] = await db.select().from(expenseCategories).limit(1);
      if (firstCat) {
        finalCategoryId = firstCat.id;
      } else {
        const [newCat] = await db.insert(expenseCategories).values({ name: 'General Operations', description: 'Office and store expenses' }).returning();
        finalCategoryId = newCat.id;
      }
    }

    const [newExp] = await db
      .insert(expenses)
      .values({
        categoryId: finalCategoryId,
        supplierId: supplierId ? Number(supplierId) : null,
        description: description.trim(),
        amount: String(Number(amount).toFixed(2)),
        vatAmount: vatAmount ? String(Number(vatAmount).toFixed(2)) : '0.00',
        expenseDate: expenseDate || new Date().toISOString().slice(0, 10),
        paymentMethod: paymentMethod || 'cash',
        referenceNo: referenceNo?.trim() || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      expense: newExp,
    });
  } catch (error: any) {
    console.error('Record Expense Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to record expense',
    }, { status: 500 });
  }
}
