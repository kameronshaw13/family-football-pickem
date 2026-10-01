import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUniversalProfile } from "@/lib/universalServerAuth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({ displayName: z.string().trim().min(1).max(60) });

export async function PATCH(req: NextRequest) {
  const auth = await requireUniversalProfile(req);
  if (!auth.profile || !auth.user) return NextResponse.json({ ok:false,error:auth.error }, { status:auth.status });
  try {
    const body=schema.parse(await req.json());
    const supabase=getSupabaseAdmin();
    const { data,error }=await supabase.from("profiles")
      .update({ display_name:body.displayName,updated_at:new Date().toISOString() })
      .eq("id",auth.profile.id)
      .select("id,display_name,username,email,is_admin")
      .single();
    if(error) throw error;
    await supabase.auth.admin.updateUserById(auth.user.id,{ user_metadata:{ ...auth.user.user_metadata, full_name:body.displayName } });
    return NextResponse.json({ok:true,profile:data});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
  }
}
