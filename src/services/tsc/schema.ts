import { z } from "zod";

export const TscOutputItemSchema = z.object({
  type: z.literal("Item"),
  value: z.object({
    path: z.object({
      type: z.literal("Path"),
      value: z.string(),
    }),
    cursor: z.object({
      type: z.literal("Cursor"),
      value: z.object({
        line: z.number(),
        col: z.number(),
      }),
    }),
    tsError: z.object({
      type: z.literal("TsError"),
      value: z.object({
        type: z.union([z.literal("error"), z.literal("warning")]),
        errorString: z.string(),
      }),
    }),
    message: z.object({
      type: z.literal("Message"),
      value: z.string(),
    }),
  }),
});
export const TscOutputSchema = z.array(TscOutputItemSchema);

export type TscOutputType = z.infer<typeof TscOutputSchema>;
export type TscOutputIemType = z.infer<typeof TscOutputItemSchema>;
