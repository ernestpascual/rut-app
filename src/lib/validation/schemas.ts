import { z } from 'zod';

export const InspirationCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300, 'Title cannot exceed 300 characters'),
  url: z
    .string()
    .max(2048, 'URL cannot exceed 2048 characters')
    .refine((val) => !val || /^https?:\/\//i.test(val), {
      message: 'Only HTTP and HTTPS URLs are accepted',
    })
    .nullable()
    .optional(),
  userNote: z.string().max(5000, 'Note cannot exceed 5000 characters').nullable().optional(),
  sharedText: z.string().max(10000, 'Shared text cannot exceed 10000 characters').nullable().optional(),
  kind: z.enum(['link', 'note', 'quote']),
  tags: z.array(z.string().max(50)).max(30, 'Maximum 30 tags allowed').default([]),
});

export const InspirationUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300, 'Title cannot exceed 300 characters').optional(),
  userNote: z.string().max(5000, 'Note cannot exceed 5000 characters').nullable().optional(),
  tags: z.array(z.string().max(50)).max(30, 'Maximum 30 tags allowed').optional(),
  archived: z.boolean().optional(),
});

export const ChatMessageCreateSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(10000, 'Message cannot exceed 10000 characters'),
  pinnedInspirationIds: z.array(z.string()).max(10).default([]),
});

export const ProjectCreateSchema = z.object({
  title: z.string().min(1, 'Project title is required').max(200, 'Title cannot exceed 200 characters'),
  brief: z.string().max(5000, 'Brief cannot exceed 5000 characters').nullable().optional(),
  notes: z.string().max(20000, 'Notes cannot exceed 20000 characters').default(''),
  tags: z.array(z.string().max(50)).max(30).default([]),
  autoLinkEnabled: z.boolean().default(false),
  autoLinkConfidenceThreshold: z.number().min(0).max(1).default(0.75),
});

export const IncomingShareSchema = z.object({
  title: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  hasBinaryAttachment: z.boolean().default(false),
});
