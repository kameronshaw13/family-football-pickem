import { z } from "zod";

/** Reset targets the server-authenticated profile, never an ID supplied in this body. */
export const passwordResetSchema = z.object({
  newPassword: z.string().min(6).max(128)
});
