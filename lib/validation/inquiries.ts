import { z } from 'zod';

export const inquiryStatuses = ['UNREAD', 'IN_PROGRESS', 'RESOLVED', 'CONVERTED', 'SPAM'] as const;
export const inquirySubjects = ['General Inquiry', 'Bulk Corporate Quotation', 'Warranty & Repair', 'CCTV Site Survey'] as const;
export const contactInquirySchema = z.object({ fullName: z.string().trim().min(2).max(150), phone: z.string().trim().regex(/^(?:\+977[- ]?)?9[678]\d{8}$/, 'Enter a valid Nepali mobile number'), email: z.email().optional().or(z.literal('')), subject: z.string().trim().min(1).max(120), message: z.string().trim().min(1).max(10000) });
export const inquiryPatchSchema = z.object({ status: z.enum(inquiryStatuses).optional(), assignedStaffId: z.number().int().positive().nullable().optional(), note: z.string().trim().max(5000).optional() });
