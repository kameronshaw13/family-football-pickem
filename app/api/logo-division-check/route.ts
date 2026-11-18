import { NextResponse } from "next/server";
import { getDivisionOneLogoDirectory } from "@/lib/d1LogoDirectory";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const teams = await getDivisionOneLogoDirectory();
    const present = (part: string) => teams.some(t => t.name.toLowerCase().includes(part));
    return NextResponse.json({
      count: teams.length,
      examples: teams.slice(0, 5).map(({name,key}) => ({name,key})),
      includeWichitaState: present("wichita state"),
      includeUC: present("riverside"),
      includeNDSU: present("north dakota state")
    });
  } catch(e) {
    return NextResponse.json({ count: 0, error: e instanceof Error ? e.message : String(e) });
  }
}
