import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { storeProfile, paymentMethodSettings, notificationPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { STAFF_ROLES, withRole } from '@/lib/auth/middleware';
import { getUserFromRequest } from '@/lib/auth/utils';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { settingsPayloadSchema, settingsTypeQuerySchema } from '@/lib/validation/commerce';
import { mergeEncryptedConfiguration, redactConfiguration } from '@/lib/settings/secrets';

/**
 * Store configuration.
 *
 * The storefront reads the profile (currency, VAT rate, free-delivery
 * threshold) and needs to know which payment methods are switched on, so those
 * are public. What is *not* public: merchant ids, provider secrets, and the
 * internal notification preferences — the previous version returned whole rows,
 * so `GET /api/settings?type=payments` handed every visitor the contents of
 * `secret_key_encrypted`.
 */
export async function GET(request: NextRequest) {
  try {
    const query = parseQuery(request.url, settingsTypeQuerySchema);
    if (!query.ok) return query.response;

    const caller = await getUserFromRequest(request);
    const isStaff = Boolean(caller && STAFF_ROLES.includes(caller.role as (typeof STAFF_ROLES)[number]));

    if (query.data.type === 'profile') {
      if (isStaff) {
        const [profile] = await db.select().from(storeProfile).limit(1);
        return NextResponse.json({
          profile: profile ? { ...profile, configuration: redactConfiguration(profile.configuration) } : null,
        });
      }

      const [profile] = await db.select({
        storeName: storeProfile.storeName,
        tagline: storeProfile.tagline,
        contactEmail: storeProfile.contactEmail,
        contactPhone: storeProfile.contactPhone,
        address: storeProfile.address,
        openingHours: storeProfile.openingHours,
        announcementText: storeProfile.announcementText,
        announcementEnabled: storeProfile.announcementEnabled,
        logoUrl: storeProfile.logoUrl,
        currency: storeProfile.currency,
        vatRatePercent: storeProfile.vatRatePercent,
        pricesIncludeVat: storeProfile.pricesIncludeVat,
        freeDeliveryThreshold: storeProfile.freeDeliveryThreshold,
      }).from(storeProfile).limit(1);
      return NextResponse.json({ profile: profile || null });
    }

    if (query.data.type === 'payments') {
      const payments = await db
        .select({
          id: paymentMethodSettings.id,
          method: paymentMethodSettings.method,
          isEnabled: paymentMethodSettings.isEnabled,
          // Staff configuring a gateway need the merchant id; nobody needs the
          // stored secret over the wire.
          ...(isStaff ? { merchantId: paymentMethodSettings.merchantId } : {}),
        })
        .from(paymentMethodSettings);

      return NextResponse.json({ payments });
    }

    // Notification routing is internal operations detail.
    if (!isStaff) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    }

    const notifications = await db.select().from(notificationPreferences);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 },
    );
  }
}

/**
 * Save one group of settings.
 *
 * `data` used to be spread straight into the table for whichever branch matched,
 * so a caller could set any column on any of these three tables — including
 * `secretKeyEncrypted` with plaintext. It is now validated per type by a
 * discriminated union, which drops anything unlisted.
 */
export const POST = withRole(['admin'], async (request: NextRequest) => {
  try {
    const parsed = await parseJson(request, settingsPayloadSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    if (payload.type === 'profile') {
      const [existing] = await db.select({ id: storeProfile.id }).from(storeProfile).limit(1);

      if (existing) {
        const [current] = await db.select({ configuration: storeProfile.configuration }).from(storeProfile).where(eq(storeProfile.id, existing.id)).limit(1);
        const data = payload.data.configuration
          ? { ...payload.data, configuration: mergeEncryptedConfiguration(current?.configuration || {}, payload.data.configuration) }
          : payload.data;
        const [updated] = await db
          .update(storeProfile)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(storeProfile.id, existing.id))
          .returning();

        return NextResponse.json({ success: true, profile: updated });
      }

      const [created] = await db.insert(storeProfile).values(payload.data).returning();
      return NextResponse.json({ success: true, profile: created }, { status: 201 });
    }

    if (payload.type === 'payment') {
      const [existing] = await db
        .select({ id: paymentMethodSettings.id })
        .from(paymentMethodSettings)
        .where(eq(paymentMethodSettings.method, payload.data.method))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(paymentMethodSettings)
          .set(payload.data)
          .where(eq(paymentMethodSettings.id, existing.id))
          .returning({
            id: paymentMethodSettings.id,
            method: paymentMethodSettings.method,
            isEnabled: paymentMethodSettings.isEnabled,
            merchantId: paymentMethodSettings.merchantId,
          });

        return NextResponse.json({ success: true, payment: updated });
      }

      const [created] = await db
        .insert(paymentMethodSettings)
        .values(payload.data)
        .returning({
          id: paymentMethodSettings.id,
          method: paymentMethodSettings.method,
          isEnabled: paymentMethodSettings.isEnabled,
          merchantId: paymentMethodSettings.merchantId,
        });

      return NextResponse.json({ success: true, payment: created }, { status: 201 });
    }

    // notification — one row per event type, so upsert rather than insert to
    // avoid a unique-constraint 500 on the second save of the same event.
    const [existing] = await db
      .select({ id: notificationPreferences.id })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.eventType, payload.data.eventType))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(notificationPreferences)
        .set(payload.data)
        .where(eq(notificationPreferences.id, existing.id))
        .returning();

      return NextResponse.json({ success: true, notification: updated });
    }

    const [created] = await db
      .insert(notificationPreferences)
      .values(payload.data)
      .returning();

    return NextResponse.json({ success: true, notification: created }, { status: 201 });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 },
    );
  }
});
