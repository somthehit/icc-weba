import { NextResponse } from 'next/server';
import { db } from '@/db';
import { carts, cartItems, products, productVariants } from '@/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import {
  addCartItemSchema,
  cartItemQuerySchema,
  updateCartItemSchema,
} from '@/lib/validation/commerce';

const MAX_QUANTITY_PER_LINE = 99;

/**
 * The caller's cart, or null if they have never added anything.
 *
 * Every handler below resolves the cart this way instead of taking `userId` or
 * `sessionId` from the request: those parameters were unchecked, so any
 * signed-in customer could read or modify another customer's basket by guessing
 * a numeric id. Guest carts (`carts.sessionId`) are unreachable from here by
 * design — the endpoint requires a session, and an anonymous visitor's cart
 * lives in the browser until they sign in.
 */
async function findCart(userId: number) {
  const [cart] = await db
    .select()
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);

  return cart ?? null;
}

async function findOrCreateCart(userId: number) {
  const existing = await findCart(userId);
  if (existing) return existing;

  const [created] = await db.insert(carts).values({ userId }).returning();
  return created;
}

export const GET = withAuth(async (_request, { user }) => {
  try {
    const cart = await findCart(user.userId);
    if (!cart) {
      return NextResponse.json({ cart: null, items: [] });
    }

    const items = await db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
        productId: cartItems.productId,
        variantId: cartItems.variantId,
        priceAtAdd: cartItems.priceAtAdd,
        productName: products.name,
        productSlug: products.slug,
        productImage: sql<string>`(SELECT url FROM product_images WHERE product_id = ${cartItems.productId} AND is_primary = true LIMIT 1)`,
        unitPrice: products.basePrice,
        stockQuantity: products.stockQuantity,
        variantName: productVariants.variantName,
        priceAdjustment: productVariants.priceAdjustment,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .where(eq(cartItems.cartId, cart.id));

    return NextResponse.json({ cart, items });
  } catch (error) {
    console.error('Error fetching cart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cart' },
      { status: 500 },
    );
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, addCartItemSchema);
    if (!parsed.ok) return parsed.response;
    const { productId, variantId, quantity } = parsed.data;

    const [product] = await db
      .select({ basePrice: products.basePrice })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // priceAtAdd is NOT NULL — snapshot the current price server-side (never trust the client)
    let priceAtAdd = Number(product.basePrice);
    if (variantId !== undefined) {
      const [variant] = await db
        .select({ priceAdjustment: productVariants.priceAdjustment })
        .from(productVariants)
        .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
        .limit(1);

      if (!variant) {
        return NextResponse.json(
          { error: 'That variant does not belong to this product' },
          { status: 400 },
        );
      }
      priceAtAdd += Number(variant.priceAdjustment);
    }

    const cart = await findOrCreateCart(user.userId);

    const [existingItem] = await db
      .select({ id: cartItems.id, quantity: cartItems.quantity })
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, productId),
          variantId !== undefined
            ? eq(cartItems.variantId, variantId)
            : isNull(cartItems.variantId),
        ),
      )
      .limit(1);

    if (existingItem) {
      // Clamped, so repeated "add to cart" clicks can't push a line past what
      // the quantity column is validated for elsewhere.
      const nextQuantity = Math.min(existingItem.quantity + quantity, MAX_QUANTITY_PER_LINE);
      await db
        .update(cartItems)
        .set({ quantity: nextQuantity })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      await db.insert(cartItems).values({
        cartId: cart.id,
        productId,
        variantId,
        quantity,
        priceAtAdd: priceAtAdd.toFixed(2),
      });
    }

    return NextResponse.json({ success: true, cartId: cart.id });
  } catch (error) {
    console.error('Error adding to cart:', error);
    return NextResponse.json(
      { error: 'Failed to add to cart' },
      { status: 500 },
    );
  }
});

/** Set the quantity of one line. Quantity 0 removes it. */
export const PUT = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, updateCartItemSchema);
    if (!parsed.ok) return parsed.response;
    const { cartItemId, quantity } = parsed.data;

    const cart = await findCart(user.userId);
    if (!cart) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
    }

    // Scoped to the caller's own cart: an id belonging to someone else simply
    // matches nothing and reads back as "not found".
    const owned = and(eq(cartItems.id, cartItemId), eq(cartItems.cartId, cart.id));

    if (quantity === 0) {
      const [removed] = await db.delete(cartItems).where(owned).returning({ id: cartItems.id });
      if (!removed) {
        return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, removed: true });
    }

    const [updated] = await db
      .update(cartItems)
      .set({ quantity })
      .where(owned)
      .returning({ id: cartItems.id, quantity: cartItems.quantity });

    if (!updated) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error updating cart item:', error);
    return NextResponse.json(
      { error: 'Failed to update cart item' },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(async (request, { user }) => {
  try {
    const query = parseQuery(request.url, cartItemQuerySchema);
    if (!query.ok) return query.response;

    const cart = await findCart(user.userId);
    if (!cart) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
    }

    const [removed] = await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, query.data.cartItemId), eq(cartItems.cartId, cart.id)))
      .returning({ id: cartItems.id });

    if (!removed) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing from cart:', error);
    return NextResponse.json(
      { error: 'Failed to remove from cart' },
      { status: 500 },
    );
  }
});
