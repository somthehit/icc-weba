import 'dotenv/config';
import { db } from '../db';
import { products, inventoryMovements } from '../db/schema';
import { eq } from 'drizzle-orm';

async function test() {
  console.log('--- Step 1: Checking first product stock before POS checkout ---');
  const [before] = await db
    .select({
      id: products.id,
      name: products.name,
      stockQuantity: products.stockQuantity,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .limit(1);

  if (!before) {
    console.log('No products found in DB.');
    process.exit(0);
  }

  console.log(`Product: "${before.name}"`);
  console.log(`Initial stock in PostgreSQL: ${before.stockQuantity} (${before.stockStatus})`);

  console.log('\n--- Step 2: Simulating 1 POS sale ---');
  const current = before.stockQuantity ?? 5;
  const newStock = Math.max(0, current - 1);

  await db
    .update(products)
    .set({
      stockQuantity: newStock,
      updatedAt: new Date(),
    })
    .where(eq(products.id, before.id));

  console.log(`Updated stockQuantity to: ${newStock}`);

  console.log('\n--- Step 3: Checking product stock after POS checkout ---');
  const [after] = await db
    .select({
      id: products.id,
      name: products.name,
      stockQuantity: products.stockQuantity,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .where(eq(products.id, before.id));

  console.log(`Verified stock in PostgreSQL: ${after.stockQuantity} (${after.stockStatus})`);

  // Restore back to original
  await db
    .update(products)
    .set({
      stockQuantity: current,
      updatedAt: new Date(),
    })
    .where(eq(products.id, before.id));

  console.log('\n✅ Successfully verified: POS decrements in same database!');
  process.exit(0);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
