/**
 * lib/procurement/po-validation.ts
 *
 * Strict Zod validation schemas for Purchase Order creation, revisions, and approval matrix.
 * Shared between client form validation and server-side route guards.
 */

import { z } from 'zod';

export const purchaseOrderLineSchema = z.object({
  id: z.string().or(z.number()).optional(),
  productId: z.string().nullable().optional(),
  sku: z.string().min(1, 'SKU is required'),
  supplierPartNo: z.string().optional().default(''),
  description: z.string().min(2, 'Item description is required'),
  quantityOrdered: z.number().int().min(1, 'Quantity ordered must be at least 1'),
  unitOfMeasure: z.string().default('Pcs'),
  unitCost: z.number().min(0.01, 'Unit cost must be greater than NPR 0.00'),
  discountPercent: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  taxCategory: z.enum(['vat_13', 'exempt']).default('vat_13'),
  vatRate: z.number().default(13.0),
  vatAmount: z.number().default(0),
  lineTotal: z.number().default(0),
  requiresSerial: z.boolean().default(false),
  lastPurchaseCost: z.number().optional().nullable(),
  averageCost: z.number().optional().nullable(),
  currentStock: z.number().optional().nullable(),
  estimatedLandedCost: z.number().optional().nullable(),
  expectedSellingPrice: z.number().optional().nullable(),
  expectedMarginPercent: z.number().optional().nullable(),
});

export const purchaseOrderFormSchema = z
  .object({
    supplierId: z.string().min(1, 'Please select a valid supplier'),
    fiscalYear: z.string().default('2082/83'),
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid order date (YYYY-MM-DD) is required'),
    expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid delivery date (YYYY-MM-DD) is required'),
    deliverToLocation: z.string().min(2, 'Delivery location is required'),
    billingReference: z.string().optional().default(''),
    paymentTerms: z.string().min(1, 'Payment terms are required'),
    currency: z.enum(['NPR', 'USD', 'INR']).default('NPR'),
    exchangeRate: z.number().positive().default(1.0),
    supplierQuoteNo: z.string().optional().default(''),
    otherCharges: z.number().min(0).default(0), // Freight, insurance, customs
    notes: z.string().optional().default(''),
    internalNotes: z.string().optional().default(''),
    items: z.array(purchaseOrderLineSchema).min(1, 'At least one line item is required in the Purchase Order'),
  })
  .refine(
    (data) => {
      const order = new Date(data.orderDate);
      const delivery = new Date(data.expectedDeliveryDate);
      return delivery >= order;
    },
    {
      message: 'Expected delivery date cannot be before the order date',
      path: ['expectedDeliveryDate'],
    }
  );

export type PurchaseOrderLineInput = z.input<typeof purchaseOrderLineSchema>;
export type PurchaseOrderLineOutput = z.output<typeof purchaseOrderLineSchema>;
export type PurchaseOrderFormInput = z.input<typeof purchaseOrderFormSchema>;
export type PurchaseOrderFormOutput = z.output<typeof purchaseOrderFormSchema>;
