import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { jadwal_id } = body

    if (!jadwal_id) return NextResponse.json({ error: 'Jadwal ID required' }, { status: 400 })

    // Menggunakan SERVICE_ROLE_KEY untuk bypass RLS karena ini operasi admin massal
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! 
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // --- CEK VALIDASI IZIN PENDING ---
    const { count, error: countErr } = await supabase
      .from('izin_sesi')
      .select('*', { count: 'exact', head: true })
      .eq('sesi_id', jadwal_id)
      .eq('status', 'pending')

    if (countErr) throw countErr

    if (count && count > 0) {
      return NextResponse.json({ 
        error: `Terdapat ${count} pengajuan izin yang masih PENDING. Harap setujui atau tolak izin tersebut di menu Perizinan terlebih dahulu!` 
      }, { status: 400 })
    }
    // ----------------------------------

    // 1. Ambil data sesi
    const { data: sesi, error: errSesi } = await supabase.from('sesi').select('*').eq('id', jadwal_id).single()
    if (errSesi || !sesi) throw new Error('Sesi tidak ditemukan')

    // 2. Susun Query target audiens
    let queryProfiles = supabase.from('profiles').select('id').eq('role', 'mahasiswa').eq('is_active', true)

    if (sesi.tipe_target === 'unit') {
      queryProfiles = queryProfiles.eq('unit', sesi.target_audiens.unit)
    } else if (sesi.tipe_target === 'unit_semester') {
      queryProfiles = queryProfiles.eq('unit', sesi.target_audiens.unit).eq('semester', sesi.target_audiens.semester)
    } else if (sesi.tipe_target === 'custom') {
      queryProfiles = queryProfiles.in('id', sesi.target_audiens.mahasiswa_ids || [])
    }

    const { data: targetMahasiswa } = await queryProfiles

    if (!targetMahasiswa || targetMahasiswa.length === 0) {
       return NextResponse.json({ alphaCreated: 0, message: 'Tidak ada target mahasiswa untuk sesi ini' })
    }

    // 3. Ambil data presensi yang sudah masuk (Hadir/Izin/Alpha)
    const { data: presensiMasuk } = await supabase.from('presensi').select('mahasiswa_id').eq('sesi_id', jadwal_id)
    const sudahAbsenIds = (presensiMasuk || []).map((p: any) => p.mahasiswa_id)

    // 4. Cari mahasiswa yang SEHARUSNYA hadir tapi belum ada di presensi
    const belumAbsen = targetMahasiswa.filter(m => !sudahAbsenIds.includes(m.id))

    if (belumAbsen.length === 0) {
       return NextResponse.json({ alphaCreated: 0, message: 'Semua mahasiswa sudah memiliki status kehadiran' })
    }

    // 5. Masukkan ke database sebagai Alpha
    const insertData = belumAbsen.map(m => ({
      mahasiswa_id: m.id,
      sesi_id: jadwal_id,
      status: 'alpha',
      waktu_absen: new Date().toISOString()
    }))

    const { error: insErr } = await supabase.from('presensi').insert(insertData)
    if (insErr) throw insErr

    return NextResponse.json({ alphaCreated: belumAbsen.length, message: 'Success' })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
