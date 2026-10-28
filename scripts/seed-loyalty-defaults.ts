// scripts/seed-loyalty-defaults.ts
import 'dotenv/config';
import { db } from '@/db';
import { loyaltyLevels, loyaltySettings, loyaltyOffers } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function seedLoyaltyDefaults() {
  console.log('Seeding default loyalty levels, settings, and starter offers...');

  // 1. Loyalty Levels
  const defaultLevels = [
    {
      id: 'silver',
      name: 'Silver',
      description: 'Standard membership for all valued customers. Earn 1 coin per NPR 100 spent.',
      displayOrder: 1,
      badgeColor: 'slate',
      icon: '🥈',
      qualifyingSpendThreshold: '0.00',
      qualifyingPeriod: 'lifetime',
      pointsEarningRate: '1.0000',
      redemptionConversionRate: '1.0000',
      minRedemptionPoints: 50,
      maxRedemptionPercentage: '50.00',
      maxRedemptionPointsPerTx: 5000,
      minPayableAfterRedemption: '50.00',
      levelDiscountPercentage: '0.00',
      isAutomaticUpgrade: true,
      isVipSpecial: false,
      isActive: true,
    },
    {
      id: 'gold',
      name: 'Gold',
      description: 'Premium membership with 1.5x coin earning and 2% extra merchandise discount.',
      displayOrder: 2,
      badgeColor: 'amber',
      icon: '🥇',
      qualifyingSpendThreshold: '25000.00',
      qualifyingPeriod: 'lifetime',
      pointsEarningRate: '1.5000',
      redemptionConversionRate: '1.0000',
      minRedemptionPoints: 50,
      maxRedemptionPercentage: '60.00',
      maxRedemptionPointsPerTx: 10000,
      minPayableAfterRedemption: '50.00',
      levelDiscountPercentage: '2.00',
      isAutomaticUpgrade: true,
      isVipSpecial: false,
      isActive: true,
    },
    {
      id: 'platinum',
      name: 'Platinum',
      description: 'Elite membership with 2x coin earning and 5% extra merchandise discount.',
      displayOrder: 3,
      badgeColor: 'slate-silver',
      icon: '💎',
      qualifyingSpendThreshold: '75000.00',
      qualifyingPeriod: 'lifetime',
      pointsEarningRate: '2.0000',
      redemptionConversionRate: '1.0000',
      minRedemptionPoints: 50,
      maxRedemptionPercentage: '70.00',
      maxRedemptionPointsPerTx: 20000,
      minPayableAfterRedemption: '50.00',
      levelDiscountPercentage: '5.00',
      isAutomaticUpgrade: true,
      isVipSpecial: false,
      isActive: true,
    },
    {
      id: 'happy_customer',
      name: 'Happy Customer',
      description: 'Top-tier VIP customer program with 3x coins and 8% exclusive discount.',
      displayOrder: 4,
      badgeColor: 'emerald',
      icon: '👑',
      qualifyingSpendThreshold: '150000.00',
      qualifyingPeriod: 'lifetime',
      pointsEarningRate: '3.0000',
      redemptionConversionRate: '1.0000',
      minRedemptionPoints: 50,
      maxRedemptionPercentage: '80.00',
      maxRedemptionPointsPerTx: 50000,
      minPayableAfterRedemption: '50.00',
      levelDiscountPercentage: '8.00',
      isAutomaticUpgrade: true,
      isVipSpecial: true,
      isActive: true,
    },
  ];

  for (const lvl of defaultLevels) {
    const existing = await db.query.loyaltyLevels?.findFirst({
      where: eq(loyaltyLevels.id, lvl.id),
    });
    if (!existing) {
      await db.insert(loyaltyLevels).values(lvl);
      console.log(`  ✓ Inserted level: ${lvl.name} (${lvl.id})`);
    } else {
      console.log(`  - Level already exists: ${lvl.name}`);
    }
  }

  // 2. Settings singleton
  const existingSettings = await db.query.loyaltySettings?.findFirst({
    where: eq(loyaltySettings.id, 'default'),
  });
  if (!existingSettings) {
    await db.insert(loyaltySettings).values({
      id: 'default',
      defaultLevelId: 'silver',
      earningBasis: 'net_after_discount',
      pointsRounding: 'floor',
      coinExpiryDays: 365,
      allowCoinRedemptionWithOffers: true,
      downgradePolicy: 'disabled',
    });
    console.log('  ✓ Initialized default loyalty settings');
  }

  // 3. Starter Offers
  const starterOffers = [
    {
      code: 'WELCOME100',
      title: 'Welcome 100 Bonus Coins',
      description: 'Get 100 bonus shopping coins on your first purchase over NPR 1,000',
      offerType: 'bonus_coins',
      offerValue: '100.00',
      eligibleLevels: ['silver', 'gold', 'platinum', 'happy_customer'],
      minSpend: '1000.00',
      usageLimitPerCustomer: 1,
      stackableWithCoins: true,
      isActive: true,
      createdBy: 'System Seed',
    },
    {
      code: 'VIP5',
      title: 'VIP 5% Member Reward',
      description: 'Exclusive 5% extra discount for Gold, Platinum & Happy Customers',
      offerType: 'percentage_discount',
      offerValue: '5.00',
      eligibleLevels: ['gold', 'platinum', 'happy_customer'],
      minSpend: '5000.00',
      maxDiscountCap: '2500.00',
      usageLimitPerCustomer: 5,
      stackableWithCoins: true,
      isActive: true,
      createdBy: 'System Seed',
    },
  ];

  for (const off of starterOffers) {
    const existingOffer = await db.query.loyaltyOffers?.findFirst({
      where: eq(loyaltyOffers.code, off.code),
    });
    if (!existingOffer) {
      await db.insert(loyaltyOffers).values(off);
      console.log(`  ✓ Inserted starter offer: ${off.code}`);
    }
  }

  console.log('✅ Loyalty defaults seeding completed successfully.');
}

seedLoyaltyDefaults()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
