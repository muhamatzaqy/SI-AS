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

    // ✅ Step 2: Get ALL profiles
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

    // ✅ Step 4: Filter by target unit
    console.log(`📍 Step 4: Filter by target_unit = '${jadwal.target_unit}'`)
    let targetProfiles = mahasiswa
    
    if (jadwal.target_unit === 'gabungan') {
      targetProfiles = mahasiswa.filter(p => p.unit === 'mahad_aly' || p.unit === 'lkim')
    } else if (jadwal.target_unit === 'mahad_aly') {
      targetProfiles = mahasiswa.filter(p => p.unit === 'mahad_aly')
    } else if (jadwal.target_unit === 'lkim') {
      targetProfiles = mahasiswa.filter(p => p.unit === 'lkim')
    }

    console.log(`✅ Target profiles: ${targetProfiles.length}`)

    if (targetProfiles.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No mahasiswa found`,
        total: 0
      })
    }

    let alphaCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errorDetails: any[] = []

    console.log(`📍 Step 5: Process ${targetProfiles.length} mahasiswa`)

    for (let i = 0; i < targetProfiles.length; i++) {
      const profile = targetProfiles[i]
      
      try {
        // Check presensi
        const { data: presensi, error: presensiCheckError } = await supabase
          .from('presensi')
          .select('*')
          .eq('jadwal_id', jadwal_id)
          .eq('mahasiswa_id', profile.id)
          .maybeSingle()

        if (presensiCheckError) {
          console.error(`   ❌ ${i}: Check presensi error:`, presensiCheckError)
          errorCount++
          errorDetails.push({
            mahasiswa: profile.nama,
            step: 'check_presensi',
            error: presensiCheckError.message
          })
          continue
        }

        if (presensi && ['hadir', 'izin', 'alpha'].includes(presensi.status)) {
          skippedCount++
          continue
        }

        // ✅ Try INSERT first (safer)
        console.log(`   📝 ${i}: Inserting for ${profile.nama}`)
        const { error: insertError } = await supabase
          .from('presensi')
          .insert({
            mahasiswa_id: profile.id,
            jadwal_id: jadwal_id,
            status: 'alpha',
            waktu_absen: now.toISOString(),
            foto_url: null,
            latitude: null,
            longitude: null
          })

        if (insertError) {
          console.error(`   ❌ ${i}: Insert error:`, insertError)
          
          // If insert fails (already exists), try update
          if (insertError.code === '23505') {
            console.log(`   🔄 ${i}: Record exists, trying update...`)
            const { error: updateError } = await supabase
              .from('presensi')
              .update({
                status: 'alpha',
                waktu_absen: now.toISOString()
              })
              .eq('mahasiswa_id', profile.id)
              .eq('jadwal_id', jadwal_id)

            if (updateError) {
              console.error(`   ❌ ${i}: Update error:`, updateError)
              errorCount++
              errorDetails.push({
                mahasiswa: profile.nama,
                step: 'update',
                error: updateError.message
              })
            } else {
              console.log(`   ✅ ${i}: Updated`)
              alphaCount++
            }
          } else {
            console.error(`   ❌ ${i}: Other insert error:`, insertError)
            errorCount++
            errorDetails.push({
              mahasiswa: profile.nama,
              step: 'insert',
              error: insertError.message,
              code: insertError.code
            })
          }
        } else {
          console.log(`   ✅ ${i}: Inserted`)
          alphaCount++
        }
      } catch (err) {
        console.error(`   ❌ ${i}: Exception`, err)
        errorCount++
        errorDetails.push({
          mahasiswa: profile.nama,
          step: 'exception',
          error: String(err)
        })
      }
    }

    console.log(`✅ DONE: ALPHA=${alphaCount}, SKIP=${skippedCount}, ERROR=${errorCount}`)
    if (errorDetails.length > 0) {
      console.log('Error details:', errorDetails.slice(0, 5))
    }

    return NextResponse.json({
      success: alphaCount > 0 || skippedCount > 0,
      alphaCreated: alphaCount,
      skipped: skippedCount,
      errors: errorCount,
      total: targetProfiles.length,
      errorSamples: errorDetails.slice(0, 5)
    })

  } catch (error) {
    console.error('❌ FATAL:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
