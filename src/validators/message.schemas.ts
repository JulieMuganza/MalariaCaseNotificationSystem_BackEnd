import { z } from 'zod';

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1).max(1500),
  conversationId: z.string().trim().min(1),
  caseRef: z.string().trim().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const markConversationReadSchema = z.object({
  conversationId: z.string().trim().min(1),
});

export type MarkConversationReadInput = z.infer<typeof markConversationReadSchema>;
