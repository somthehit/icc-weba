// db/wipe-products.ts
//
// Safely wipes all products, inventory, inventory movements, and product-dependent records
// resetting primary key identities cleanly.

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

async function main() {
  console.log('🧹 Wiping all products and inventory movements...');

  const tablesToTruncate = [
    'inventory_movements',
    'inventory',
    'product_specs',
    'product_images',
    'product_variants',
    'product_attribute_values',
    'product_filter_tags',
    'order_items',
    'cart_items',
    'reviews',
    'purchase_bill_items',
    'service_tickets',
    'products',
  ]
    .map((t) => `"${t}"`)
    .join(', ');

  await db.execute(sql.raw(`TRUNCATE TABLE ${tablesToTruncate} RESTART IDENTITY CASCADE;`));

  console.log('✅ Successfully wiped all products, inventory movements, and dependent records.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed to wipe products and movements:', err);
    process.exit(1);
  });
