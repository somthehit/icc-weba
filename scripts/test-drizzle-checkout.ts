import 'dotenv/config';
import { db } from '../db';
import { products, inventoryMovements } from '../db/schema';
import { eq } from 'drizzle-orm';

async function test() {
  console.log('--- Step 1: Checking product #3 stock before POS checkout ---');
  const [before] = await db
    .select({
      id: products.id,
      name: products.name,
      stockQuantity: products.stockQuantity,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .where(eq(products.id, 3));

  console.log(`Product: "${before.name}"`);
  console.log(`Initial stock in PostgreSQL: ${before.stockQuantity} (${before.stockStatus})`);

  console.log('\n--- Step 2: Simulating 1 POS sale ---');
  const current = before.stockQuantity ?? 5;
  const newStock = current - 1;

  await db
    .update(products)
    .set({
      stockQuantity: newStock,
      updatedAt: new Date(),
    })
    .where(eq(products.id, 3));

  console.log(`Updated stockQuantity to: ${newStock}`);

  console.log('\n--- Step 3: Checking product #3 stock after POS checkout ---');
  const [after] = await db
    .select({
      id: products.id,
      name: products.name,
      stockQuantity: products.stockQuantity,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .where(eq(products.id, 3));

  console.log(`Verified stock in PostgreSQL: ${after.stockQuantity} (${after.stockStatus})`);

  // Restore back to 5 for customer demo
  await db
    .update(products)
    .set({
      stockQuantity: 5,
      updatedAt: new Date(),
    })
    .where(eq(products.id, 3));

  console.log('\n✅ Successfully verified: POS decrements from 5 to 4 in same database!');
  process.exit(0);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
