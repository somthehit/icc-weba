const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function migrate() {
  console.log('--- Creating pos_bank_qrs table if not exists ---');
  await sql`
    CREATE TABLE IF NOT EXISTS "pos_bank_qrs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "bank_name" varchar(100) NOT NULL,
      "account_name" varchar(150) NOT NULL,
      "account_number" varchar(60) NOT NULL,
      "qr_type" varchar(50) NOT NULL DEFAULT 'fonepay',
      "merchant_code" varchar(100),
      "qr_image_url" text,
      "qr_payload_template" text,
      "chart_account_id" uuid,
      "is_active" boolean NOT NULL DEFAULT true,
      "is_default" boolean NOT NULL DEFAULT false,
      "display_order" integer NOT NULL DEFAULT 0,
      "instructions" text,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "pos_bank_qrs_active_order_idx" 
    ON "pos_bank_qrs" ("is_active", "display_order");
  `;

  const existing = await sql`SELECT count(*) FROM "pos_bank_qrs"`;
  console.log('Current pos_bank_qrs count:', existing[0].count);

  if (parseInt(existing[0].count, 10) === 0) {
    console.log('Seeding initial bank & wallet QR codes...');
    await sql`
      INSERT INTO "pos_bank_qrs" 
        ("bank_name", "account_name", "account_number", "qr_type", "merchant_code", "is_active", "is_default", "display_order", "instructions", "qr_payload_template")
      VALUES
        ('Nabil Bank (Fonepay)', 'Intel Computer Center Pvt. Ltd.', '01201017500123', 'fonepay', 'ICC-NABIL-01', true, true, 1, 'Scan with Nabil Smart, Fonepay, Global, Siddhartha or any Mobile Banking App', 'fonepay://pay?merchant=ICC-NABIL-01&amount={amount}&remarks={orderId}'),
        ('NIC Asia Bank (Smart QR)', 'Intel Computer Center Pvt. Ltd.', '04257501234567', 'smart_qr', 'NIC-ICC-DHG-99', true, false, 2, 'Scan with MoBank, Smart QR or any NepalPay supported mobile banking app', 'smartqr://pay?merchant=NIC-ICC-DHG-99&amount={amount}&remarks={orderId}'),
        ('eSewa Merchant QR', 'Intel Computer Center', '9801234567', 'esewa', 'ESEWA-ICC-RETAIL', true, false, 3, 'Scan with eSewa App or any linked partner wallet', 'esewa://pay?merchant=ESEWA-ICC-RETAIL&amount={amount}&remarks={orderId}'),
        ('Global IME Bank (NepalPay)', 'Intel Computer Center Pvt. Ltd.', '00101010098765', 'bank_nepal_pay', 'GIBL-ICC-04', true, false, 4, 'Scan with Global Smart Plus or NepalPay network apps', 'nepalpay://pay?merchant=GIBL-ICC-04&amount={amount}&remarks={orderId}')
    `;
    console.log('Initial bank QR codes seeded successfully!');
  }

  const rows = await sql`SELECT id, bank_name, qr_type, is_active, is_default FROM "pos_bank_qrs"`;
  console.log('pos_bank_qrs in DB:', rows);

  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
