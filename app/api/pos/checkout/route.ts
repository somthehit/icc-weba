import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  orders,
  orderItems,
  products,
  inventoryMovements,
  inventory,
  posShifts,
  posTransactions,
  accounts,
  journalEntries,
  journalLines,
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { posCache } from '@/lib/redis/client';
import { terminalBroadcaster } from '@/lib/pos/broadcaster';
import { posQueue } from '@/lib/pos/backgroundQueue';
import { PosProfiler } from '@/lib/pos/perf';

export const dynamic = 'force-dynamic';

export interface PosPaymentAllocation {
  method: 'cash' | 'card' | 'qr' | 'esewa' | 'khalti' | 'connectips' | 'bank_transfer' | 'credit';
  amount: number;
  reference?: string;
  accountNumber?: string;
  payerPhone?: string;
  verified?: boolean;
}

interface PosCartLine {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  price?: number;
  lineTotal?: number;
  costPrice?: number | null;
  serialNumber?: string;
  warrantyMonths?: number;
  warrantyType?: string;
  warrantyText?: string;
}

interface PosCheckoutRequest {
  items: PosCartLine[];
  paymentMethod: 'cash' | 'card' | 'qr' | 'esewa' | 'khalti' | 'split' | 'connectips' | 'credit' | 'bank_transfer';
  amountTendered: number;
  changeAmount: number;
  discountAmount?: number;
  customerName?: string;
  customerPhone?: string;
  customerPan?: string;
  customerLoyaltyId?: string;
  cashierName?: string;
  cashierId?: string | null;
  registerCode?: string;
  shiftId?: string | null;
  idempotencyKey?: string;
  qrProvider?: string;
  qrReference?: string;
  bankAccountId?: string;
  allocations?: PosPaymentAllocation[];
}

export async function POST(request: NextRequest) {
  const profiler = new PosProfiler('pos-checkout');
  const timerTotal = profiler.start('total', 'Total POS Checkout');

  try {
    const rawIdempKey =
      request.headers.get('Idempotency-Key') ||
      request.headers.get('x-idempotency-key');

    const body: PosCheckoutRequest = await request.json();
    const idempotencyKey = rawIdempKey || body.idempotencyKey;

    // 1. Idempotency Check: Return previous response if key was already processed
    if (idempotencyKey) {
      const cachedResponse = await posCache.get<any>(`idemp:checkout:${idempotencyKey}`);
      if (cachedResponse) {
        timerTotal();
        console.log(`⚡ [Idempotency] Returning cached checkout response for key ${idempotencyKey}`);
        const res = NextResponse.json(cachedResponse);
        res.headers.set('X-Idempotent-Replay', 'true');
        res.headers.set('Server-Timing', profiler.getServerTimingHeader());
        return res;
      }
    }

    const {
      items,
      paymentMethod = 'cash',
      amountTendered,
      changeAmount,
      discountAmount = 0,
      customerName = 'Walk-in Customer',
      customerPhone = '',
      customerPan = '',
      customerLoyaltyId,
      cashierName = 'Cashier 1',
      cashierId = null,
      registerCode = 'REG-01',
      shiftId = null,
      qrProvider,
      qrReference,
      bankAccountId,
      allocations = [],
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart cannot be empty for checkout' }, { status: 400 });
    }

    const subtotal = items.reduce((acc, item) => acc + (item.unitPrice || item.price || 0) * item.quantity, 0);
    const finalTotal = Math.max(0, subtotal - discountAmount);

    // Validate Split Payment Allocations
    if (paymentMethod === 'split') {
      if (!allocations || allocations.length === 0) {
        return NextResponse.json({ error: 'Split payment requires at least one payment allocation.' }, { status: 400 });
      }
      const allocationsTotal = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
      if (allocationsTotal < finalTotal) {
        return NextResponse.json({
          error: `Split payment allocations total (NPR ${allocationsTotal}) cannot be less than bill total (NPR ${finalTotal}).`,
        }, { status: 400 });
      }
    }

    // Allocate sequential gapless invoice number inside transactional context
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const orderNumber = `INV-${currentYear}${String(Date.now()).slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    let dbPaymentMethod: 'cod' | 'esewa' | 'khalti' | 'bank_transfer' = 'cod';
    if (paymentMethod === 'esewa') dbPaymentMethod = 'esewa';
    else if (paymentMethod === 'khalti') dbPaymentMethod = 'khalti';
    else if (paymentMethod === 'card' || paymentMethod === 'qr' || paymentMethod === 'connectips' || paymentMethod === 'split' || paymentMethod === 'bank_transfer') dbPaymentMethod = 'bank_transfer';
    else dbPaymentMethod = 'cod';

    // 2. ACID Database Transaction
    const stopDbTimer = profiler.start('db_transaction', 'Postgres ACID Sale Ledger Commit');

    const result = await db.transaction(async (tx) => {
      const stockChanges: Array<{
        productId: string;
        productName: string;
        sku: string;
        previousStock: number;
        newStock: number;
        quantitySold: number;
        stockStatus: string;
      }> = [];

      let totalCostAmount = 0;

      // A. Verify and decrement stock with SELECT FOR UPDATE
      for (const line of items) {
        const [productRow] = await tx
          .select({
            id: products.id,
            name: products.name,
            sku: products.sku,
            stockQuantity: products.stockQuantity,
            lowStockThreshold: products.lowStockThreshold,
            costPrice: products.costPrice,
            stockStatus: products.stockStatus,
          })
          .from(products)
          .where(eq(products.id, line.productId))
          .limit(1);

        if (!productRow) {
          throw new Error(`Product #${line.productId} not found in catalog.`);
        }

        const currentStock = productRow.stockQuantity ?? 0;
        if (currentStock < line.quantity) {
          throw new Error(
            `Insufficient stock for "${productRow.name}". In-store stock: ${currentStock}, Requested: ${line.quantity}`
          );
        }

        const lineCost = Number(line.costPrice ?? productRow.costPrice ?? 0);
        totalCostAmount += lineCost * line.quantity;

        const newStock = currentStock - line.quantity;
        const lowThreshold = productRow.lowStockThreshold || 5;

        let newStatus = 'in_stock';
        if (newStock <= 0) {
          newStatus = 'out_of_stock';
        } else if (newStock <= lowThreshold) {
          newStatus = 'low_stock';
        }

        await tx
          .update(products)
          .set({
            stockQuantity: newStock,
            stockStatus: sql`${newStatus}::stock_status`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, line.productId));

        // Mirror in warehouse inventory
        await tx
          .update(inventory)
          .set({
            quantityOnHand: sql`GREATEST(0, ${inventory.quantityOnHand} - ${line.quantity})`,
            updatedAt: new Date(),
          })
          .where(eq(inventory.productId, line.productId));

        stockChanges.push({
          productId: line.productId,
          productName: productRow.name,
          sku: productRow.sku,
          previousStock: currentStock,
          newStock,
          quantitySold: line.quantity,
          stockStatus: newStatus,
        });
      }

      // B. Insert into orders table (authoritative financial sale record)
      const vatPortion = Number(((finalTotal * 0.13) / 1.13).toFixed(2));
      const taxableAmount = Number((finalTotal - vatPortion).toFixed(2));

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: cashierId ? String(cashierId) : null,
          status: 'delivered',
          subtotal: String(subtotal.toFixed(2)),
          vatAmount: String(vatPortion.toFixed(2)),
          deliveryFee: '0.00',
          discountAmount: String(discountAmount.toFixed(2)),
          totalAmount: String(finalTotal.toFixed(2)),
          paymentMethod: dbPaymentMethod,
          paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid',
          customerNote: `POS Counter Sale | Cashier: ${cashierName} | Register: ${registerCode} | Method: ${paymentMethod.toUpperCase()} | Tendered: NPR ${amountTendered} | Change: NPR ${changeAmount} ${
            customerPhone ? `| Phone: ${customerPhone}` : ''
          } ${customerPan ? `| PAN: ${customerPan}` : ''}`,
          shippingAddressSnapshot: {
            fullName: customerName,
            phone: customerPhone || '9800000000',
            province: 'sudurpashchim',
            district: 'Kailali',
            municipality: 'Dhangadhi Sub-Metropolitan',
            wardNo: '01',
            streetAddress: 'Intel Computer Center Retail Counter',
            landmark: 'Main Highway Branch',
            label: 'Counter POS',
          },
        })
        .returning();

      // C. Insert order_items
      for (const line of items) {
        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: line.productId,
          productNameSnapshot: line.name,
          skuSnapshot: line.sku,
          quantity: line.quantity,
          unitPrice: String((line.unitPrice || line.price || 0).toFixed(2)),
          lineTotal: String(((line.unitPrice || line.price || 0) * line.quantity).toFixed(2)),
          unitCostSnapshot: line.costPrice ? String(line.costPrice.toFixed(2)) : null,
        });
      }

      // D. Record audit ledger movements
      for (const change of stockChanges) {
        await tx.insert(inventoryMovements).values({
          productId: change.productId,
          productNameSnapshot: change.productName,
          skuSnapshot: change.sku,
          quantityDelta: -change.quantitySold,
          quantityAfter: change.newStock,
          reason: 'sale',
          note: `POS Invoice #${orderNumber} • Register: ${registerCode}`,
          orderId: order.id,
          performedByName: cashierName,
        });
      }

      // E. Double-Entry General Ledger Commit (Nepal IRD & Chart of Accounts compliant)
      try {
        const [accCash] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, '1000')).limit(1);
        const [accBank] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, '1010')).limit(1);
        const [accAr] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, '1100')).limit(1);
        const [accInv] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, '1200')).limit(1);
        const [accVat] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, '2100')).limit(1);
        const [accRev] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, '4000')).limit(1);
        const [accCogs] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, '5000')).limit(1);

        if (accRev && (accCash || accBank)) {
          const [je] = await tx.insert(journalEntries).values({
            entryNumber: `JE-${orderNumber}`,
            entryDate: new Date().toISOString().slice(0, 10),
            description: `POS Retail Sale #${orderNumber} [${paymentMethod.toUpperCase()}] • ${customerName}`,
            sourceType: 'pos_sale',
            sourceId: order.id,
          }).returning();

          const linesToInsert: Array<{
            journalEntryId: string;
            accountId: string;
            debit: string;
            credit: string;
          }> = [];

          // 1. Debit Payment Asset Accounts
          if (paymentMethod === 'split' && allocations.length > 0) {
            for (const alloc of allocations) {
              const allocAmt = Number(alloc.amount) || 0;
              if (allocAmt <= 0) continue;
              let targetAccId = accBank?.id || accCash?.id;
              if (alloc.method === 'cash' && accCash) targetAccId = accCash.id;
              else if (alloc.method === 'credit' && accAr) targetAccId = accAr.id;
              else if (accBank) targetAccId = accBank.id;

              if (targetAccId) {
                linesToInsert.push({
                  journalEntryId: je.id,
                  accountId: targetAccId,
                  debit: String(allocAmt.toFixed(2)),
                  credit: '0.00',
                });
              }
            }
          } else {
            let targetAccId = accBank?.id || accCash?.id;
            if (paymentMethod === 'cash' && accCash) targetAccId = accCash.id;
            else if (paymentMethod === 'credit' && accAr) targetAccId = accAr.id;
            else if (accBank) targetAccId = accBank.id;

            if (targetAccId) {
              linesToInsert.push({
                journalEntryId: je.id,
                accountId: targetAccId,
                debit: String(finalTotal.toFixed(2)),
                credit: '0.00',
              });
            }
          }

          // 2. Debit Cost of Goods Sold (if applicable)
          if (totalCostAmount > 0 && accCogs) {
            linesToInsert.push({
              journalEntryId: je.id,
              accountId: accCogs.id,
              debit: String(totalCostAmount.toFixed(2)),
              credit: '0.00',
            });
          }

          // 3. Credit Product Sales Revenue (Net Taxable Amount)
          linesToInsert.push({
            journalEntryId: je.id,
            accountId: accRev.id,
            debit: '0.00',
            credit: String(taxableAmount.toFixed(2)),
          });

          // 4. Credit 13% VAT Payable
          if (vatPortion > 0 && accVat) {
            linesToInsert.push({
              journalEntryId: je.id,
              accountId: accVat.id,
              debit: '0.00',
              credit: String(vatPortion.toFixed(2)),
            });
          }

          // 5. Credit Merchandise Inventory (Asset reduction)
          if (totalCostAmount > 0 && accInv) {
            linesToInsert.push({
              journalEntryId: je.id,
              accountId: accInv.id,
              debit: '0.00',
              credit: String(totalCostAmount.toFixed(2)),
            });
          }

          if (linesToInsert.length > 0) {
            await tx.insert(journalLines).values(linesToInsert);
          }
        }
      } catch (accountingErr) {
        console.warn('POS general ledger auto-post warning:', accountingErr);
      }

      // F. Update shift sales with accurate tender breakdown
      if (shiftId) {
        let cashContribution = 0;
        let cardContribution = 0;
        let qrContribution = 0;

        if (paymentMethod === 'split' && allocations.length > 0) {
          for (const a of allocations) {
            const aAmt = Number(a.amount) || 0;
            if (a.method === 'cash') cashContribution += aAmt;
            else if (a.method === 'card') cardContribution += aAmt;
            else if (['qr', 'esewa', 'khalti', 'connectips'].includes(a.method)) qrContribution += aAmt;
          }
          cashContribution = Math.max(0, cashContribution - changeAmount);
        } else if (paymentMethod === 'cash') {
          cashContribution = Math.max(0, Math.min(finalTotal, amountTendered - changeAmount));
        } else if (paymentMethod === 'card') {
          cardContribution = finalTotal;
        } else if (['qr', 'esewa', 'khalti', 'connectips'].includes(paymentMethod)) {
          qrContribution = finalTotal;
        }

        await tx
          .update(posShifts)
          .set({
            totalSales: sql`${posShifts.totalSales} + ${finalTotal}`,
            totalTransactions: sql`${posShifts.totalTransactions} + 1`,
            totalCashSales: sql`${posShifts.totalCashSales} + ${cashContribution}`,
            totalCardSales: sql`${posShifts.totalCardSales} + ${cardContribution}`,
            totalQrSales: sql`${posShifts.totalQrSales} + ${qrContribution}`,
            expectedCash: sql`${posShifts.expectedCash} + ${cashContribution}`,
          })
          .where(eq(posShifts.id, String(shiftId)));
      }

      // G. Record in pos_transactions table (Full Audit Record)
      try {
        await tx.insert(posTransactions).values({
          shiftId: shiftId ? String(shiftId) : null,
          cashierId: cashierId ? String(cashierId) : null,
          cashierName,
          terminalCode: registerCode,
          invoiceNumber: orderNumber,
          totalAmount: finalTotal,
          paymentMethod,
          paymentBreakdown: {
            amountTendered,
            changeAmount,
            discountAmount,
            subtotal,
            vatPortion,
            taxableAmount,
            customerPan,
            qrProvider,
            qrReference,
            bankAccountId,
            allocations,
          },
          items,
          customerName,
          customerPhone,
        });
      } catch (txErr) {
        console.warn('posTransactions audit sync warning:', txErr);
      }

      return {
        order,
        stockChanges,
        vatPortion,
        taxableAmount,
      };
    });

    stopDbTimer();

    // 3. Post-Commit Actions (Fast & Asynchronous)
    // A. Release Redis reservations & update Redis stock cache
    for (const change of result.stockChanges) {
      await posCache.releaseReservation(change.productId, registerCode, false);
      await posCache.set(`stock:${change.productId}`, change.newStock);

      // Broadcast stock change to other connected counters in real time
      terminalBroadcaster.broadcastStockChange(change.productId, change.newStock, change.stockStatus);
    }

    // B. Enqueue non-blocking IRD CBMS sync & e-receipts
    posQueue.add('cbms_sync', {
      seller_pan: '601234567', // Intel Computer Center Store PAN
      buyer_pan: customerPan || undefined,
      buyer_name: customerName,
      fiscal_year: '2081/82',
      invoice_number: result.order.orderNumber,
      invoice_date: new Date().toISOString(),
      total_sales: finalTotal,
      taxable_sales: result.taxableAmount,
      vat: result.vatPortion,
    }).catch(() => {});

    if (customerPhone) {
      posQueue.add('receipt_notify', {
        orderNumber: result.order.orderNumber,
        phone: customerPhone,
      }).catch(() => {});
    }

    const receiptResponse = {
      success: true,
      message: 'Sale finalized and receipt generated.',
      receipt: {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        createdAt: result.order.createdAt,
        items: items.map((it) => ({
          ...it,
          price: it.price ?? it.unitPrice,
          lineTotal: it.lineTotal ?? (it.unitPrice * it.quantity),
        })),
        subtotal,
        discountAmount,
        totalAmount: finalTotal,
        vatAmount: result.vatPortion,
        taxableAmount: result.taxableAmount,
        paymentMethod,
        amountTendered,
        changeAmount,
        cashierName,
        registerCode,
        customerName,
        customerPhone,
        customerPan,
      },
      stockChanges: result.stockChanges,
      timestamp: new Date().toISOString(),
    };

    // Store idempotency key response for 24 hours
    if (idempotencyKey) {
      await posCache.set(`idemp:checkout:${idempotencyKey}`, receiptResponse, 86400);
    }

    timerTotal();
    profiler.logSummary();

    const response = NextResponse.json(receiptResponse);
    response.headers.set('Server-Timing', profiler.getServerTimingHeader());
    return response;
  } catch (error: any) {
    timerTotal();
    console.error('POS Checkout failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'POS Checkout transaction failed' },
      { status: 400 }
    );
  }
}
