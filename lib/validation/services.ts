import { z } from 'zod';

export const rmsStatuses = ['PENDING_INSPECTION', 'DIAGNOSING', 'QUOTATION_AWAITING', 'IN_PROGRESS', 'READY_FOR_PICKUP', 'DELIVERED_CLOSED'] as const;
const base = z.object({ customerName: z.string().trim().min(2).max(150), phone: z.string().trim().min(7).max(15), email: z.email().optional(), type: z.enum(['repair', 'cctv_survey', 'installation', 'warranty_claim', 'other']).default('repair'), subject: z.string().trim().min(2).max(200), description: z.string().max(5000).optional(), deviceBrand: z.string().max(100).optional(), deviceModel: z.string().max(150).optional(), serialNumber: z.string().max(120).optional(), preferredDate: z.coerce.date().optional(), preferredTime: z.string().max(80).optional(), serviceAddress: z.string().max(500).optional() });
export const walkInSchema = base.extend({ conditionChecklist: z.record(z.string(), z.boolean()).default({}), lockCode: z.string().max(120).optional(), advanceAmount: z.coerce.number().min(0).transform(String).default('0') });
export const onlineBookingSchema = base;
export const serviceStatusSchema = z.object({ workflowStatus: z.enum(rmsStatuses), assignedTo: z.number().int().positive().nullable().optional(), note: z.string().max(1000).optional(), chargedAmount: z.coerce.number().min(0).transform(String).optional() });
