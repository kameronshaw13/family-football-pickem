import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUniversalProfile } from "@/lib/universalServerAuth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({
  leagueName: z.string().trim().min(2).max(60),
  inviteCode: z.string().trim().min(4).max(20).regex(/^[A-Za-z0-9-]+$/),
  playerTier: z.enum(["1-10","11-24","25-39","40+"]),
  format: z.enum(["pickem","pickem-sidebets","sidebets"]),
  footballSlate: z.enum(["CFB","NFL","BOTH"]),
  scoringMode: z.enum(["winning-percentage","total-wins","confidence"]),
  weeklyPicks: z.number().int().min(3).max(15),
  dogEnabled: z.boolean(),
  dogPicks: z.number().int().min(1).max(3),
  sideBetMoneyline: z.boolean(),
  sideBetTotals: z.boolean(),
  sideBetLive: z.boolean(),
  ledgerUnit: z.enum(["bucks","points"]),
  weekOpen: z.enum(["monday-9","tuesday-9"]),
  lockMode: z.enum(["kickoff","saturday-11"]),
  startMode: z.enum(["season","now"]),
  startWeeks: z.object({ CFB: z.number().int().min(0).max(30).nullable(), NFL: z.number().int().min(1).max(30).nullable() })
});

function slugBase(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 38) || "league";
}

export async function POST(req: NextRequest) {
  const auth = await requireUniversalProfile(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = schema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const seasonYear = new Date().getFullYear();
    const inviteCode = body.inviteCode.toUpperCase();

    const { data: existingInvite } = await supabase.from("group_invites").select("id").ilike("code", inviteCode).maybeSingle();
    if (existingInvite) return NextResponse.json({ ok: false, error: "That invite code is already in use." }, { status: 409 });

    const base = slugBase(body.leagueName);
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: existing } = await supabase.from("pickem_groups").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = base + "-" + Math.random().toString(36).slice(2, 6);
    }

    const eligibleLeagues = body.footballSlate === "BOTH" ? ["CFB", "NFL"] : [body.footballSlate];
    const rules = {
      universalApp: true,
      productMode: body.format,
      footballSlate: body.footballSlate,
      eligibleLeagues,
      excludedTeams: [],
      playerTier: body.playerTier,
      pickRules: {
        default: {
          regularTotal: body.format === "sidebets" ? 0 : body.weeklyPicks,
          cfbMinimum: 0,
          nflMinimum: 0,
          underdogTotal: body.format === "sidebets" || !body.dogEnabled ? 0 : body.dogPicks,
          perfectBonus: false
        },
        weekOverrides: {}
      },
      scoring: {
        mode: body.scoringMode === "confidence" ? "confidence" : "record",
        ranking: body.scoringMode === "total-wins" ? "total-wins" : "winning-percentage",
        pushMultiplier: 0.5
      },
      underdog: {
        enabled: body.format !== "sidebets" && body.dogEnabled,
        minimumSpread: 7,
        tiers: [
          { min: 7, max: 9.5, bonusWins: 1 },
          { min: 10, max: 19.5, bonusWins: 2 },
          { min: 20, max: null, bonusWins: 3 }
        ]
      },
      sideBets: {
        enabled: body.format !== "pickem",
        moneyline: body.sideBetMoneyline,
        totals: body.sideBetTotals,
        live: body.sideBetLive,
        ledgerUnit: body.ledgerUnit,
        amountEntry: "free",
        maxAmount: null,
        maxPerWeek: null
      },
      schedule: { weekOpen: body.weekOpen, lockMode: body.lockMode },
      startMode: body.startMode,
      startWeeks: body.startWeeks
    };

    const { data: group, error: groupError } = await supabase.from("pickem_groups").insert({
      slug,
      name: body.leagueName,
      short_name: body.leagueName.slice(0, 28),
      current_season_year: seasonYear,
      timezone: "America/Chicago",
      is_default: false,
      is_active: true,
      branding: { theme: "shaw-retro", universalApp: true }
    }).select("id,slug,name,short_name,current_season_year").single();

    if (groupError || !group) return NextResponse.json({ ok: false, error: groupError?.message || "Could not create league." }, { status: 500 });

    const cleanup = async () => { await supabase.from("pickem_groups").delete().eq("id", group.id); };

    const { error: seasonError } = await supabase.from("group_seasons").insert({
      group_id: group.id,
      season_year: seasonYear,
      status: "active",
      rules
    });
    if (seasonError) { await cleanup(); return NextResponse.json({ ok: false, error: seasonError.message }, { status: 500 }); }

    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: group.id,
      profile_id: auth.profile.id,
      role: "admin",
      status: "active"
    });
    if (memberError) { await cleanup(); return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 }); }

    const { error: inviteError } = await supabase.from("group_invites").insert({
      group_id: group.id,
      code: inviteCode,
      created_by_profile_id: auth.profile.id,
      is_active: true
    });
    if (inviteError) { await cleanup(); return NextResponse.json({ ok: false, error: inviteError.message }, { status: 500 }); }

    return NextResponse.json({ ok: true, group, inviteCode });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
