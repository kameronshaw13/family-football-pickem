import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUniversalProfile } from "@/lib/universalServerAuth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const patchSchema=z.object({
  slug:z.string().trim().min(1).max(80),
  leagueName:z.string().trim().min(2).max(60),
  inviteCode:z.string().trim().min(4).max(20).regex(/^[A-Za-z0-9-]+$/)
});

async function commissionerContext(profileId:string,slug:string){
  const supabase=getSupabaseAdmin();
  const { data:group,error:groupError }=await supabase.from("pickem_groups")
    .select("id,slug,name,short_name,current_season_year")
    .eq("slug",slug).maybeSingle();
  if(groupError) throw groupError;
  if(!group) return {supabase,group:null,membership:null};
  const { data:membership,error:membershipError }=await supabase.from("group_members")
    .select("role,status").eq("group_id",group.id).eq("profile_id",profileId).maybeSingle();
  if(membershipError) throw membershipError;
  return {supabase,group,membership};
}

export async function GET(req:NextRequest){
  const auth=await requireUniversalProfile(req);
  if(!auth.profile) return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
  try{
    const slug=req.nextUrl.searchParams.get("slug")||"";
    const {supabase,group,membership}=await commissionerContext(auth.profile.id,slug);
    if(!group||!membership||membership.status!=="active"||!["admin","owner"].includes(membership.role)) return NextResponse.json({ok:false,error:"Commissioner access required."},{status:403});
    const [{data:season,error:seasonError},{data:invite,error:inviteError},{count,error:countError}]=await Promise.all([
      supabase.from("group_seasons").select("rules").eq("group_id",group.id).eq("season_year",group.current_season_year).maybeSingle(),
      supabase.from("group_invites").select("code,max_uses").eq("group_id",group.id).eq("is_active",true).maybeSingle(),
      supabase.from("group_members").select("profile_id",{count:"exact",head:true}).eq("group_id",group.id).eq("status","active")
    ]);
    if(seasonError) throw seasonError;if(inviteError) throw inviteError;if(countError) throw countError;
    return NextResponse.json({ok:true,group,rules:season?.rules||{},inviteCode:invite?.code||"",memberCount:count||0,playerLimit:invite?.max_uses==null?null:Number(invite.max_uses)+1});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});}
}

export async function PATCH(req:NextRequest){
  const auth=await requireUniversalProfile(req);
  if(!auth.profile) return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
  try{
    const body=patchSchema.parse(await req.json());
    const {supabase,group,membership}=await commissionerContext(auth.profile.id,body.slug);
    if(!group||!membership||membership.status!=="active"||!["admin","owner"].includes(membership.role)) return NextResponse.json({ok:false,error:"Commissioner access required."},{status:403});
    const code=body.inviteCode.toUpperCase();
    const {data:conflict,error:conflictError}=await supabase.from("group_invites").select("id,group_id").ilike("code",code).neq("group_id",group.id).maybeSingle();
    if(conflictError) throw conflictError;
    if(conflict) return NextResponse.json({ok:false,error:"That invite code is already in use."},{status:409});
    const {error:groupUpdateError}=await supabase.from("pickem_groups").update({name:body.leagueName,short_name:body.leagueName.slice(0,28),updated_at:new Date().toISOString()}).eq("id",group.id);
    if(groupUpdateError) throw groupUpdateError;
    const {error:inviteUpdateError}=await supabase.from("group_invites").update({code,updated_at:new Date().toISOString()}).eq("group_id",group.id).eq("is_active",true);
    if(inviteUpdateError) throw inviteUpdateError;
    return NextResponse.json({ok:true,leagueName:body.leagueName,inviteCode:code});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});}
}
