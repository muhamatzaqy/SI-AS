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

    // ✅ Get all mahasiswa - IMPROVED QUERY
    // Get profiles where role is mahasiswa OR where unit matches jadwal target_unit
    let profileQuery = supabase
      .from('profiles')
      .select('id, nama, unit, role')

    // Filter by target_unit if jadwal is for specific unit
    if (jadwal.target_unit !== 'gabungan') {
      profileQuery = profileQuery.or(`unit.eq.${jadwal.target_unit},role.eq.mahasiswa`)
    } else {
      // For 'gabungan', get all with role mahasiswa or all units
      profileQuery = profileQuery.eq('role', 'mahasiswa')
    }

    const { data: profiles, error: profileError } = await profileQuery

    if (profileError) {
      console.error('❌ Error fetching mahasiswa:', profileError)
      throw new Error(`Failed to fetch mahasiswa: ${profileError.message}`)
    }

    console.log(`📋 Found ${profiles?.length || 0} mahasiswa`)
    if (profiles && profiles.length > 0) {
      console.log('   Sample profiles:', profiles.slice(0, 3).map(p => ({ id: p.id, nama: p.nama, unit: p.unit })))
    }

    let alpaCount = 0
    let skippedCount = 0
    let errorCount = 0
    const results: any[] = []

    if (!profiles || profiles.length === 0) {
      console.warn('⚠️ No mahasiswa found for this jadwal')
      return NextResponse.json({
        success: false,
        message: 'No mahasiswa found for this jadwal',
        jadwal_nama: jadwal.nama_kegiatan,
        alpaCreated: 0,
        skipped: 0,
        total: 0,
        details: []
      })
    }

    // ✅ For each mahasiswa, check and set alpa if needed
    for (const profile of profiles) {
      try {
        const { data: presensi, error: presensiError } = await supabase
          .from('presensi')
          .select('id, status')
          .eq('jadwal_id', jadwal_id)
          .eq('mahasiswa_id', profile.id)
          .maybeSingle() // ✅ Use maybeSingle instead of single for flexibility

        // If record exists, check status
        if (presensi) {
          // Record exists - check status
          if (presensi.status === 'alpa' || presensi.status === 'izin' || presensi.status === 'sakit' || presensi.status === 'hadir') {
            // Already has valid status - skip
            console.log(`   ⏭️ Skip ${profile.nama} - status: ${presensi.status}`)
            skippedCount++
            results.push({
              mahasiswa_nama: profile.nama,
              status: 'skipped',
              reason: `Already has status: ${presensi.status}`
            })
            continue
          }
        }

        // No record or need to create - set alpa
        const { error: upsertError } = await supabase
          .from('presensi')
          .upsert({
            mahasiswa_id: profile.id,
            jadwal_id: jadwal_id,
            status: 'alpa', // ✅ Using 'alpa' (matches DB)
            waktu_absen: now.toISOString(),
            foto_url: null,
            latitude: null,
            longitude: null
          }, {
            onConflict: 'mahasiswa_id,jadwal_id'
          })

        if (upsertError) {
          console.error(`   ❌ Error for ${profile.nama}:`, upsertError)
          errorCount++
          results.push({
            mahasiswa_nama: profile.nama,
            status: 'error',
            reason: upsertError.message
          })
        } else {
          console.log(`   ✅ ALPA set for ${profile.nama}`)
          alpaCount++
          results.push({
            mahasiswa_nama: profile.nama,
            status: 'alpa_set',
            reason: 'No attendance record'
          })
        }
      } catch (profileError) {
        console.error(`   ❌ Error processing ${profile.nama}:`, profileError)
        errorCount++
      }
    }

    console.log(`✅ Completed. ALPA: ${alpaCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`)

    return NextResponse.json({
      success: true,
      message: `Successfully set ${alpaCount} mahasiswa as ALPA for "${jadwal.nama_kegiatan}"`,
      jadwal_nama: jadwal.nama_kegiatan,
      alpaCreated: alpaCount,
      skipped: skippedCount,
      errors: errorCount,
      total: profiles?.length || 0,
      details: results.slice(0, 10) // Return first 10 for brevity
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
