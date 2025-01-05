import { z } from 'zod';

export const CharacterSchema = z.object({
  name: z.string(),
  description: z.string(),
  clients: z.array(z.enum(['twitter'])),
  templates: z.object({
    twitterPostTemplate: z.string(),
    twitterReplyTemplate: z.string()
  })
});

export type Character = z.infer<typeof CharacterSchema>;
