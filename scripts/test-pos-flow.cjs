const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function testFlow() {
  const sql = postgres(dbUrl, { ssl: 'require' });

  console.log('--- Step 1: Checking product #3 before POS sale ---');
  const [before] = await sql`SELECT id, name, sku, stock_quantity, stock_status FROM products WHERE id = 3`;
  console.log(`Product: "${before.name}"`);
  console.log(`Initial Stock in Database (Online & Physical): ${before.stock_quantity} (${before.stock_status})`);

  console.log('\n--- Step 2: Simulating POS Sale of 1 unit ---');
  // We simulate what /api/pos/checkout does in a transaction
  await sql.begin(async (tx) => {
    const qtyToSell = 1;
    const newStock = before.stock_quantity - qtyToSell;
    const newStatus = newStock <= 0 ? 'out_of_stock' : (newStock <= 5 ? 'low_stock' : 'in_stock');

    await tx`
      UPDATE products 
      SET stock_quantity = ${newStock},
          stock_status = ${newStatus}::stock_status,
          updated_at = NOW()
      WHERE id = 3
    `;

    const negQty = -qtyToSell;
    await tx`
      INSERT INTO inventory_movements (
        product_id, product_name_snapshot, sku_snapshot,
        quantity_delta, quantity_after, reason, note, performed_by_name
      ) VALUES (
        3, ${before.name}, ${before.sku},
        ${negQty}::int, ${newStock}::int, 'sale', 'In-Store POS Sale Test [Register A]', 'Sarah Jenkins'
      )
    `;

    console.log(`Transaction committed! Decremented ${qtyToSell} unit.`);
  });

  console.log('\n--- Step 3: Checking product #3 after POS sale ---');
  const [after] = await sql`SELECT id, name, sku, stock_quantity, stock_status FROM products WHERE id = 3`;
  console.log(`Updated Stock in Database (Online & Physical): ${after.stock_quantity} (${after.stock_status})`);

  console.log('\n--- Step 4: Verification of Inventory Movement Audit Trail ---');
  const [movement] = await sql`
    SELECT id, product_name_snapshot, quantity_delta, quantity_after, reason, note, created_at 
    FROM inventory_movements 
    WHERE product_id = 3 
    ORDER BY id DESC 
    LIMIT 1
  `;
  console.log('Movement logged:', movement);

  // Restore the stock back to 5 for clean demo state
  console.log('\n--- Restoring test unit back to 5 ---');
  await sql`UPDATE products SET stock_quantity = 5, stock_status = 'in_stock' WHERE id = 3`;
  console.log('Restored to 5 for initial demo.');

  await sql.end();
}

testFlow().catch(console.error);
