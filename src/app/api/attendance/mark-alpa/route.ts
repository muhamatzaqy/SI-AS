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

    console.log('📝 Mark Alpa Request for jadwal_id:', jadwal_id)

    // ✅ Get jadwal details
    const { data: jadwal, error: jadwalError } = await supabase
      .from('jadwal_kegiatan')
      .select('id, nama_kegiatan, tanggal, target_unit')
      .eq('id', jadwal_id)
      .single()

    if (jadwalError) {
      console.error('❌ Jadwal not found:', jadwalError)
      throw new Error(`Jadwal not found: ${jadwalError.message}`)
    }

    console.log('✅ Jadwal found:', jadwal.nama_kegiatan)
    console.log('   Target unit:', jadwal.target_unit)

    // ✅ Get ALL profiles (no unit filter - let logic handle it)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, nama, unit, role')

    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError)
      throw new Error(`Failed to fetch profiles: ${profileError.message}`)
    }

    console.log(`📋 Found ${profiles?.length || 0} total profiles`)

    // ✅ Filter profiles based on jadwal target_unit
    let targetProfiles = profiles || []
    
    if (jadwal.target_unit === 'gabungan') {
      // For 'gabungan', include ALL profiles
      console.log('   Including ALL profiles (gabungan target)')
    } else {
      // For specific unit, filter by exact match
      targetProfiles = targetProfiles.filter(p => p.unit === jadwal.target_unit)
      console.log(`   Filtered to ${targetProfiles.length} profiles for unit: ${jadwal.target_unit}`)
    }

    if (targetProfiles.length === 0) {
      console.warn(`⚠️ No mahasiswa found for target_unit: ${jadwal.target_unit}`)
      return NextResponse.json({
        success: false,
        message: `No mahasiswa found for target_unit: ${jadwal.target_unit}`,
        jadwal_nama: jadwal.nama_kegiatan,
        target_unit: jadwal.target_unit,
        alpaCreated: 0,
        skipped: 0,
        total: 0,
        details: []
      })
    }

    let alpaCount = 0
    let skippedCount = 0
    let errorCount = 0
    const results: any[] = []

    console.log(`🔄 Processing ${targetProfiles.length} profiles...`)

    // ✅ For each mahasiswa, check and set alpa if needed
    for (const profile of targetProfiles) {
      try {
        // Check if presensi record exists
        const { data: presensi, error: presensiError } = await supabase
          .from('presensi')
          .select('id, status')
          .eq('jadwal_id', jadwal_id)
          .eq('mahasiswa_id', profile.id)
          .maybeSingle()

        if (presensiError && presensiError.code !== 'PGRST116') {
          // Real error (not "no rows")
          throw presensiError
        }

        // If record exists, check status
        if (presensi) {
          // Record exists - check status
          const validStatuses = ['alpa', 'izin', 'sakit', 'hadir']
          if (validStatuses.includes(presensi.status)) {
            // Already has valid status - skip
            console.log(`   ⏭️ Skip ${profile.nama} - already has status: ${presensi.status}`)
            skippedCount++
            results.push({
              mahasiswa_nama: profile.nama,
              status: 'skipped',
              reason: `Already has status: ${presensi.status}`
            })
            continue
          }
        }

        // No record exists - create ALPA record
        console.log(`   📝 Creating ALPA for ${profile.nama} (${profile.unit})`)
        const { error: upsertError } = await supabase
          .from('presensi')
          .insert({
            mahasiswa_id: profile.id,
            jadwal_id: jadwal_id,
            status: 'alpa',
            waktu_absen: now.toISOString(),
            foto_url: null,
            latitude: null,
            longitude: null
          })

        if (upsertError) {
          // If unique constraint error, try update instead
          if (upsertError.code === '23505') {
            const { error: updateError } = await supabase
              .from('presensi')
              .update({
                status: 'alpa',
                waktu_absen: now.toISOString()
              })
              .eq('jadwal_id', jadwal_id)
              .eq('mahasiswa_id', profile.id)

            if (updateError) {
              console.error(`   ❌ Update error for ${profile.nama}:`, updateError)
              errorCount++
            } else {
              console.log(`   ✅ Updated ALPA for ${profile.nama}`)
              alpaCount++
            }
          } else {
            console.error(`   ❌ Error for ${profile.nama}:`, upsertError)
            errorCount++
            results.push({
              mahasiswa_nama: profile.nama,
              status: 'error',
              reason: upsertError.message
            })
          }
        } else {
          console.log(`   ✅ Created ALPA for ${profile.nama}`)
          alpaCount++
          results.push({
            mahasiswa_nama: profile.nama,
            status: 'alpa_set',
            reason: 'No attendance record'
          })
        }
      } catch (profileError) {
        console.error(`   ❌ Exception for ${profile.nama}:`, profileError)
        errorCount++
      }
    }

    console.log(`✅ Completed. ALPA: ${alpaCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`)

    return NextResponse.json({
      success: alpaCount > 0,
      message: `Successfully set ${alpaCount} mahasiswa as ALPA for "${jadwal.nama_kegiatan}"`,
      jadwal_nama: jadwal.nama_kegiatan,
      target_unit: jadwal.target_unit,
      alpaCreated: alpaCount,
      skipped: skippedCount,
      errors: errorCount,
      total: targetProfiles.length,
      details: results.slice(0, 20)
    })

  } catch (error) {
    console.error('❌ Mark Alpa Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
