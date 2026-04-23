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
      console.error('❌ Jadwal not found:', jadwalError)
      throw new Error(`Jadwal not found: ${jadwalError.message}`)
    }

    console.log('✅ Jadwal found:', jadwal.nama_kegiatan)
    console.log('   Target unit:', jadwal.target_unit)

    // ✅ Get ALL profiles
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
      console.log('   ✅ Including ALL profiles (gabungan target)')
    } else {
      targetProfiles = targetProfiles.filter(p => p.unit === jadwal.target_unit)
      console.log(`   ✅ Filtered to ${targetProfiles.length} profiles for unit: ${jadwal.target_unit}`)
    }

    if (targetProfiles.length === 0) {
      console.warn(`⚠️ No profiles found for target_unit: ${jadwal.target_unit}`)
      return NextResponse.json({
        success: false,
        message: `No profiles found for target_unit: ${jadwal.target_unit}`,
        jadwal_nama: jadwal.nama_kegiatan,
        target_unit: jadwal.target_unit,
        alphaCreated: 0,
        skipped: 0,
        total: 0,
        details: []
      })
    }

    let alphaCount = 0
    let skippedCount = 0
    let errorCount = 0
    const results: any[] = []

    console.log(`🔄 Processing ${targetProfiles.length} profiles...`)

    // ✅ For each profile, check and set alpha if needed
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
          throw presensiError
        }

        // If record exists, check status
        if (presensi) {
          // Record exists - check status
          // ✅ Only allow: hadir, izin, alpha (from DB constraint)
          const validStatuses = ['hadir', 'izin', 'alpha']
          
          if (validStatuses.includes(presensi.status)) {
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

        // No record exists or needs update - create/update ALPHA record
        console.log(`   📝 Setting ALPHA for ${profile.nama}`)
        
        const { error: upsertError } = await supabase
          .from('presensi')
          .upsert(
            {
              mahasiswa_id: profile.id,
              jadwal_id: jadwal_id,
              status: 'alpha', // ✅ Only valid status: hadir, izin, alpha
              waktu_absen: now.toISOString(),
              foto_url: null,
              latitude: null,
              longitude: null
            },
            {
              onConflict: 'mahasiswa_id,jadwal_id'
            }
          )

        if (upsertError) {
          console.error(`   ❌ Error for ${profile.nama}:`, upsertError)
          errorCount++
          results.push({
            mahasiswa_nama: profile.nama,
            status: 'error',
            reason: upsertError.message
          })
        } else {
          console.log(`   ✅ Alpha set for ${profile.nama}`)
          alphaCount++
          results.push({
            mahasiswa_nama: profile.nama,
            status: 'alpha_set',
            reason: 'No attendance record'
          })
        }
      } catch (profileError) {
        console.error(`   ❌ Exception for ${profile.nama}:`, profileError)
        errorCount++
      }
    }

    console.log(`✅ Completed. ALPHA: ${alphaCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`)

    return NextResponse.json({
      success: alphaCount > 0 || skippedCount > 0,
      message: `Successfully set ${alphaCount} profiles as ALPHA for "${jadwal.nama_kegiatan}". ${skippedCount} already have attendance records.`,
      jadwal_nama: jadwal.nama_kegiatan,
      target_unit: jadwal.target_unit,
      alphaCreated: alphaCount,
      skipped: skippedCount,
      errors: errorCount,
      total: targetProfiles.length,
      details: results.slice(0, 20)
    })

  } catch (error) {
    console.error('❌ Mark Alpha Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
