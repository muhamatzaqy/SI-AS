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
      .select('id, nama_kegiatan, tanggal')
      .eq('id', jadwal_id)
      .single()

    if (jadwalError) {
      console.error('❌ Jadwal not found:', jadwalError)
      throw jadwalError
    }

    console.log('✅ Jadwal found:', jadwal.nama_kegiatan)

    // ✅ Get all mahasiswa
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, nama')
      .eq('role', 'mahasiswa')

    if (profileError) {
      console.error('❌ Error fetching mahasiswa:', profileError)
      throw profileError
    }

    console.log(`📋 Found ${profiles?.length || 0} mahasiswa`)

    let alpaCount = 0
    let skippedCount = 0
    const results: any[] = []

    // ✅ For each mahasiswa, check and set alpa if needed
    if (profiles) {
      for (const profile of profiles) {
        const { data: presensi, error: presensiError } = await supabase
          .from('presensi')
          .select('id, status')
          .eq('jadwal_id', jadwal_id)
          .eq('mahasiswa_id', profile.id)
          .single()

        // Check if record exists
        if (!presensiError) {
          // Record exists - check status
          if (presensi?.status === 'izin' || presensi?.status === 'sakit' || presensi?.status === 'hadir') {
            // Already has valid status - skip
            console.log(`   ⏭️ Skip ${profile.nama} - status: ${presensi?.status}`)
            skippedCount++
            results.push({
              mahasiswa_nama: profile.nama,
              status: 'skipped',
              reason: `Already has status: ${presensi?.status}`
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
            status: 'alpa',
            waktu_absen: now.toISOString(),
            foto_url: null,
            latitude: null,
            longitude: null
          })

        if (upsertError) {
          console.error(`   ❌ Error for ${profile.nama}:`, upsertError)
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
      }
    }

    console.log(`✅ Completed. ALPA: ${alpaCount}, Skipped: ${skippedCount}`)

    return NextResponse.json({
      success: true,
      message: `Successfully set ${alpaCount} mahasiswa as ALPA for "${jadwal.nama_kegiatan}"`,
      jadwal_nama: jadwal.nama_kegiatan,
      alpaCreated: alpaCount,
      skipped: skippedCount,
      total: profiles?.length || 0,
      details: results
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
