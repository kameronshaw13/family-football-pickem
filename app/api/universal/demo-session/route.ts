import { NextResponse } from "next/server";
import { createProfileSession, setSessionCookie } from "@/lib/authServer";
import { makeSessionToken } from "@/lib/passwords";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = getSupabaseAdmin();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,username,display_name,is_admin")
    .eq("username","demo-you")
    .maybeSingle();
  if(profileError || !profile) return NextResponse.json({ok:false,error:profileError?.message || "Demo profile is missing."},{status:500});

  const { data: group, error: groupError } = await supabase
    .from("pickem_groups")
    .select("id")
    .eq("slug","demo")
    .maybeSingle();
  if(groupError || !group) return NextResponse.json({ok:false,error:groupError?.message || "Demo league is missing."},{status:500});

  await Promise.all([
    supabase.from("picks").delete().eq("group_id",group.id).eq("user_id",profile.id),
    supabase.from("side_bets").delete().eq("group_id",group.id).or(`creator_id.eq.${profile.id},accepted_by.eq.${profile.id}`),
    supabase.from("profile_sessions").delete().eq("profile_id",profile.id)
  ]);

  const token=makeSessionToken();
  const sessionError=await createProfileSession(profile.id,token);
  if(sessionError) return NextResponse.json({ok:false,error:sessionError.message},{status:500});

  const response=NextResponse.json({ok:true,token,profile});
  setSessionCookie(response,token);
  return response;
}
