import { z } from "zod";

/** Shared incoming side bet action validation. */
const viewWeek = z.number().int().nonnegative().optional();
export const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    gameId: z.string().min(1),
    creatorTeam: z.string().min(1),
    amount: z.number().positive(),
    recipientIds: z.array(z.string().uuid()).min(1).max(10),
    marketType: z.enum(["spread", "moneyline", "total"]).optional(),
    offerPhase: z.enum(["pregame", "live"]).optional(),
    creatorSpread: z.number().finite().min(-100).max(100).optional(),
    totalPoints: z.number().finite().min(0).max(200).optional(),
    creatorOdds: z.number().int().optional(),
    visibleLiveHomeScore: z.number().int().nonnegative().optional(),
    visibleLiveAwayScore: z.number().int().nonnegative().optional(),
    viewWeek
  }),
  z.object({
    action: z.literal("accept"),
    sideBetId: z.string().uuid(),
    visibleLiveHomeScore: z.number().int().nonnegative().optional(),
    visibleLiveAwayScore: z.number().int().nonnegative().optional(),
    viewWeek
  }),
  z.object({ action: z.literal("decline"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({ action: z.literal("cancel"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({ action: z.literal("clear"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({
    action: z.literal("expireLiveScores"),
    offers: z.array(z.object({
      sideBetId: z.string().uuid(),
      visibleLiveHomeScore: z.number().int().nonnegative(),
      visibleLiveAwayScore: z.number().int().nonnegative()
    })).min(1).max(20),
    viewWeek
  })
]);

