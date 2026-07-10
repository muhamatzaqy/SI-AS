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
    const { count: pendingCount, error: countErr } = await supabase
      .from('izin_sesi')
      .select('*', { count: 'exact', head: true })
      .eq('sesi_id', jadwal_id)
      .eq('status', 'pending')

    if (countErr) throw countErr

    if (pendingCount && pendingCount > 0) {
      return NextResponse.json({ 
        error: `Terdapat ${pendingCount} pengajuan izin yang masih PENDING. Harap setujui atau tolak izin tersebut di menu Perizinan terlebih dahulu!` 
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

    // 3. Ambil data presensi yang sudah masuk (Hadir/Izin/Alpha yang sudah ada)
    const { data: presensiMasuk } = await supabase.from('presensi').select('mahasiswa_id').eq('sesi_id', jadwal_id)
    const sudahAbsenIds = (presensiMasuk || []).map((p: any) => p.mahasiswa_id)

    // PERBAIKAN: Ambil daftar mahasiswa yang izinnya sudah APPROVED
    const { data: izinApproved } = await supabase
      .from('izin_sesi')
      .select('mahasiswa_id')
      .eq('sesi_id', jadwal_id)
      .eq('status', 'approved')
    
    const izinApprovedIds = (izinApproved || []).map((i: any) => i.mahasiswa_id)

    // 4. Cari mahasiswa yang belum ada di tabel presensi
    const belumAbsen = targetMahasiswa.filter(m => !sudahAbsenIds.includes(m.id))

    if (belumAbsen.length === 0) {
       return NextResponse.json({ alphaCreated: 0, message: 'Semua mahasiswa sudah memiliki status kehadiran' })
    }

    // 5. Pisahkan mana yang berhak mendapat 'Izin' dan mana yang benar-benar 'Alpha'
    const insertData: any[] = []
    let totalAlphaCounter = 0

    const waktuSekarang = new Date().toISOString()

    belumAbsen.forEach(m => {
      // Jika ID mahasiswa ada di daftar izin yang di-approve, beri status 'izin'
      if (izinApprovedIds.includes(m.id)) {
        insertData.push({
          mahasiswa_id: m.id,
          sesi_id: jadwal_id,
          status: 'izin',
          waktu_absen: waktuSekarang
        })
      } 
      // Jika tidak ada di daftar izin sama sekali, baru beri status 'alpha'
      else {
        insertData.push({
          mahasiswa_id: m.id,
          sesi_id: jadwal_id,
          status: 'alpha',
          waktu_absen: waktuSekarang
        })
        totalAlphaCounter++
      }
    })

    // 6. Masukkan semua data ke database sekaligus
    if (insertData.length > 0) {
      const { error: insErr } = await supabase.from('presensi').insert(insertData)
      if (insErr) throw insErr
    }

    return NextResponse.json({ 
      alphaCreated: totalAlphaCounter, 
      message: 'Success' 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
