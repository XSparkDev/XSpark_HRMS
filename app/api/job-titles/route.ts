import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("job_titles")
      .select("id, title")
      .order("title", { ascending: true })

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error fetching job titles:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch job titles" },
      { status: 500 }
    )
  }
}

