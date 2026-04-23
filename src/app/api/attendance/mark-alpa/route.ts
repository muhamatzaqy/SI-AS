import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { jadwal_id } = await req.json()
    
    if (!jadwal_id) {
      return NextResponse.json(
        { error: 'jadwal_id required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    const now = new Date()

    console.log('📝 Mark Alpha Request for jadwal_id:', jadwal_id)

    // ✅ Get jadwal details
    const { data: jadwal, error: jadwalError } = await supabase
      .from('jadwal_kegiatan')
      .select('id, nama_kegiatan, tanggal, target_unit')
      .eq('id', jadwal_id)
      .single()

    if (jadwalError) {
      console.error('❌ Jadwal error:', jadwalError)
      return NextResponse.json(
        { error: `Jadwal not found: ${jadwalError.message}` },
        { status: 400 }
      )
    }

    console.log('✅ Jadwal found:', jadwal.nama_kegiatan, jadwal.target_unit)

    // ✅ Get all profiles with role mahasiswa
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from('profiles')
      .select('id, nama, unit, role')
      .eq('role', 'mahasiswa')

    if (allProfilesError) {
      console.error('❌ All profiles error:', allProfilesError)
      return NextResponse.json(
        { error: `Failed to fetch profiles: ${allProfilesError.message}` },
        { status: 400 }
      )
    }

    console.log(`📋 Total mahasiswa: ${allProfiles?.length || 0}`)

    // ✅ Filter by unit in JavaScript (more reliable)
    let targetProfiles: any[] = []
    
    if (jadwal.target_unit === 'gabungan') {
      targetProfiles = allProfiles?.filter(p => 
        p.unit === 'mahad_aly' || p.unit === 'lkim'
      ) || []
      console.log(`   ✅ Gabungan filter: ${targetProfiles.length} mahasiswa`)
    } else if (jadwal.target_unit === 'mahad_aly' || jadwal.target_unit === 'lkim') {
      targetProfiles = allProfiles?.filter(p => p.unit === jadwal.target_unit) || []
      console.log(`   ✅ Unit ${jadwal.target_unit} filter: ${targetProfiles.length} mahasiswa`)
    } else {
      console.warn(`⚠️ Unknown target_unit: ${jadwal.target_unit}`)
    }

    if (targetProfiles.length === 0) {
      console.warn(`⚠️ No profiles found after filtering`)
      return NextResponse.json({
        success: false,
        message: `No mahasiswa found for target_unit: ${jadwal.target_unit}`,
        jadwal_nama: jadwal.nama_kegiatan,
        target_unit: jadwal.target_unit,
        alphaCreated: 0,
        skipped: 0,
        errors: 0,
        total: 0,
        details: []
      })
    }

    let alphaCount = 0
    let skippedCount = 0
    let errorCount = 0

    console.log(`🔄 Processing ${targetProfiles.length} mahasiswa...`)

    // ✅ Process each mahasiswa
    for (const profile of targetProfiles) {
      try {
        // Check presensi
        const { data: presensi, error: presensiError } = await supabase
          .from('presensi')
          .select('id, status')
          .eq('jadwal_id', jadwal_id)
          .eq('mahasiswa_id', profile.id)
          .maybeSingle()

        if (presensiError && presensiError.code !== 'PGRST116') {
          console.error(`   ❌ Presensi query error for ${profile.nama}:`, presensiError)
          errorCount++
          continue
        }

        // Check if already has status
        if (presensi && ['hadir', 'izin', 'alpha'].includes(presensi.status)) {
          console.log(`   ⏭️ Skip ${profile.nama} - status: ${presensi.status}`)
          skippedCount++
          continue
        }

        // Upsert alpha
        const { error: upsertError } = await supabase
          .from('presensi')
          .upsert({
            mahasiswa_id: profile.id,
            jadwal_id: jadwal_id,
            status: 'alpha',
            waktu_absen: now.toISOString(),
            foto_url: null,
            latitude: null,
            longitude: null
          }, {
            onConflict: 'mahasiswa_id,jadwal_id'
          })

        if (upsertError) {
          console.error(`   ❌ Upsert error for ${profile.nama}:`, upsertError)
          errorCount++
        } else {
          console.log(`   ✅ Alpha set for ${profile.nama}`)
          alphaCount++
        }
      } catch (err) {
        console.error(`   ❌ Exception for ${profile.nama}:`, err)
        errorCount++
      }
    }

    console.log(`✅ Result: ALPHA=${alphaCount}, SKIP=${skippedCount}, ERROR=${errorCount}`)

    return NextResponse.json({
      success: alphaCount > 0 || skippedCount > 0,
      message: `Set ${alphaCount} mahasiswa as ALPHA. ${skippedCount} skipped.`,
      jadwal_nama: jadwal.nama_kegiatan,
      target_unit: jadwal.target_unit,
      alphaCreated: alphaCount,
      skipped: skippedCount,
      errors: errorCount,
      total: targetProfiles.length
    })

  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
