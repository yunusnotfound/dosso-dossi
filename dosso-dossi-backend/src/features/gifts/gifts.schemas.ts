import { z } from 'zod';

export const sendGiftSchema = z
  .object({
    recipientPhone: z.string().min(10).max(20),
    type: z.enum(['drink', 'balance']),
    productId: z.string().optional(),
    amount: z.number().positive().max(100_000).optional(),
    note: z.string().trim().max(200).default(''),
  })
  .refine((v) => (v.type === 'drink' ? !!v.productId : v.amount !== undefined), {
    message: 'İçecek hediyesi için productId, bakiye hediyesi için amount gerekli',
  });

export type SendGiftInput = z.infer<typeof sendGiftSchema>;
