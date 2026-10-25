const { SignJWT } = require('jose');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const secretMatch = env.match(/JWT_SECRET="?([^"\r\n]+)"?/);
const secret = new TextEncoder().encode(secretMatch[1]);

async function test() {
  const posToken = await new SignJWT({
    userId: 1,
    email: 'cashier@pos.local',
    role: 'cashier',
    scope: 'pos',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('ice-computers')
    .setAudience('ice-computers-web')
    .setExpirationTime('1h')
    .sign(secret);

  console.log('1. Testing call to /api/accounting with POS-scoped token:');
  const res1 = await fetch('http://localhost:3000/api/accounting', {
    headers: { Authorization: `Bearer ${posToken}` },
  });
  console.log('   HTTP Status:', res1.status);
  const data1 = await res1.json();
  console.log('   Response Body:', data1);

  console.log('2. Testing call to /api/admin/inventory with POS-scoped token:');
  const res2 = await fetch('http://localhost:3000/api/admin/inventory', {
    headers: { Authorization: `Bearer ${posToken}` },
  });
  console.log('   HTTP Status:', res2.status);
  const data2 = await res2.json();
  console.log('   Response Body:', data2);

  console.log('3. Testing call to /api/pos/products with POS-scoped token:');
  const res3 = await fetch('http://localhost:3000/api/pos/products?limit=2', {
    headers: { Authorization: `Bearer ${posToken}` },
  });
  console.log('   HTTP Status:', res3.status);
}

test().catch(console.error);
