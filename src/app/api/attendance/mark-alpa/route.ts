import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { jadwal_id } = await req.json()
    console.log('🚀 START - jadwal_id:', jadwal_id)
    
    if (!jadwal_id) {
      return NextResponse.json({ error: 'jadwal_id required' }, { status: 400 })
    }

    const supabase = createClient()
    const now = new Date()

    // ✅ Step 1: Get jadwal
    console.log('📍 Step 1: Fetch jadwal')
    const { data: jadwal, error: jadwalError } = await supabase
      .from('jadwal_kegiatan')
      .select('*')
      .eq('id', jadwal_id)
      .single()

    if (jadwalError) {
      console.error('❌ Jadwal error:', jadwalError)
      return NextResponse.json({ error: jadwalError.message }, { status: 400 })
    }
    console.log('✅ Jadwal:', jadwal.nama_kegiatan, 'target_unit:', jadwal.target_unit)

    // ✅ Step 2: Get ALL profiles (no filter!)
    console.log('📍 Step 2: Fetch ALL profiles')
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')

    if (profileError) {
      console.error('❌ Profiles error:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }
    console.log(`✅ Total profiles: ${profiles?.length}`)

    // ✅ Step 3: Filter role = mahasiswa
    console.log('📍 Step 3: Filter role = mahasiswa')
    let mahasiswa = profiles?.filter(p => p.role === 'mahasiswa') || []
    console.log(`✅ Mahasiswa count: ${mahasiswa.length}`)
    if (mahasiswa.length > 0) {
      console.log('   Sample:', mahasiswa[0])
    }

    // ✅ Step 4: Filter by target unit
    console.log(`📍 Step 4: Filter by target_unit = '${jadwal.target_unit}'`)
    let targetProfiles = mahasiswa
    
    if (jadwal.target_unit === 'gabungan') {
      targetProfiles = mahasiswa.filter(p => p.unit === 'mahad_aly' || p.unit === 'lkim')
      console.log(`   Gabungan: ${targetProfiles.length}`)
    } else if (jadwal.target_unit === 'mahad_aly') {
      targetProfiles = mahasiswa.filter(p => p.unit === 'mahad_aly')
      console.log(`   mahad_aly: ${targetProfiles.length}`)
      console.log('   Units in mahasiswa:', [...new Set(mahasiswa.map(p => p.unit))])
    } else if (jadwal.target_unit === 'lkim') {
      targetProfiles = mahasiswa.filter(p => p.unit === 'lkim')
      console.log(`   lkim: ${targetProfiles.length}`)
    }

    console.log(`✅ Target profiles: ${targetProfiles.length}`)

    if (targetProfiles.length === 0) {
      console.warn('⚠️ No target profiles found!')
      return NextResponse.json({
        success: false,
        message: `No mahasiswa found`,
        total: 0,
        mahasiswaCount: mahasiswa.length,
        unitValues: [...new Set(mahasiswa.map(p => p.unit))]
      })
    }

    let alphaCount = 0
    let skippedCount = 0
    let errorCount = 0

    console.log(`📍 Step 5: Process ${targetProfiles.length} mahasiswa`)

    for (let i = 0; i < targetProfiles.length; i++) {
      const profile = targetProfiles[i]
      
      try {
        const { data: presensi } = await supabase
          .from('presensi')
          .select('*')
          .eq('jadwal_id', jadwal_id)
          .eq('mahasiswa_id', profile.id)
          .maybeSingle()

        if (presensi && ['hadir', 'izin', 'alpha'].includes(presensi.status)) {
          skippedCount++
          continue
        }

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
          console.error(`   ❌ ${i}: ${profile.nama} error:`, upsertError)
          errorCount++
        } else {
          console.log(`   ✅ ${i}: ${profile.nama}`)
          alphaCount++
        }
      } catch (err) {
        console.error(`   ❌ ${i}: Exception`, err)
        errorCount++
      }
    }

    console.log(`✅ DONE: ALPHA=${alphaCount}, SKIP=${skippedCount}, ERROR=${errorCount}`)

    return NextResponse.json({
      success: true,
      alphaCreated: alphaCount,
      skipped: skippedCount,
      errors: errorCount,
      total: targetProfiles.length
    })

  } catch (error) {
    console.error('❌ FATAL:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
