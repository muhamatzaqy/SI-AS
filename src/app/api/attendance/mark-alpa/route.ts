import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { jadwal_id } = body

    if (!jadwal_id) return NextResponse.json({ error: 'Jadwal ID required' }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! 
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Ambil data sesi LEBIH DULU agar kita tahu tanggal kegiatannya
    const { data: sesi, error: errSesi } = await supabase.from('sesi').select('*').eq('id', jadwal_id).single()
    if (errSesi || !sesi) throw new Error('Sesi tidak ditemukan')

    // --- CEK VALIDASI IZIN SESI (PENDING) ---
    const { count: pendingSesiCount, error: countSesiErr } = await supabase
      .from('izin_sesi')
      .select('*', { count: 'exact', head: true })
      .eq('sesi_id', jadwal_id)
      .eq('status', 'pending')

    if (countSesiErr) throw countSesiErr

    if (pendingSesiCount && pendingSesiCount > 0) {
      return NextResponse.json({ 
        error: `Terdapat ${pendingSesiCount} izin SESI yang masih PENDING. Harap setujui/tolak terlebih dahulu!` 
      }, { status: 400 })
    }

    // --- CEK VALIDASI IZIN PULANG PERIODE (PENDING) ---
    // Memeriksa apakah ada izin pulang yang menabrak tanggal sesi ini
    const { count: pendingPulangCount, error: countPulangErr } = await supabase
      .from('izin_pulang')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('tgl_pulang', sesi.tanggal) // tgl_pulang <= sesi.tanggal
      .gte('tgl_kembali', sesi.tanggal) // tgl_kembali >= sesi.tanggal

    if (countPulangErr) throw countPulangErr

    if (pendingPulangCount && pendingPulangCount > 0) {
      return NextResponse.json({ 
        error: `Terdapat ${pendingPulangCount} pengajuan IZIN PULANG yang masih PENDING di tanggal ini. Harap proses terlebih dahulu!` 
      }, { status: 400 })
    }
    // ----------------------------------

    // 2. Susun Query target audiens
    let queryProfiles = supabase.from('profiles').select('id').eq('role', 'mahasiswa').neq('is_active', false)

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

    // 4A. Ambil daftar mahasiswa yang IZIN SESI-nya APPROVED
    const { data: izinSesiApproved } = await supabase
      .from('izin_sesi')
      .select('mahasiswa_id')
      .eq('sesi_id', jadwal_id)
      .eq('status', 'approved')
    const izinSesiIds = (izinSesiApproved || []).map((i: any) => i.mahasiswa_id)

    // 4B. Ambil daftar mahasiswa yang IZIN PULANG-nya APPROVED dan menutupi tanggal sesi ini
    const { data: izinPulangApproved } = await supabase
      .from('izin_pulang')
      .select('mahasiswa_id')
      .eq('status', 'approved')
      .lte('tgl_pulang', sesi.tanggal)
      .gte('tgl_kembali', sesi.tanggal)
    const izinPulangIds = (izinPulangApproved || []).map((i: any) => i.mahasiswa_id)

    // Gabungkan semua ID mahasiswa yang punya izin sah di hari ini
    // MENJADI SEPERTI INI:
    const allApprovedIzinIds = Array.from(new Set([...izinSesiIds, ...izinPulangIds]))

    // 5. Cari mahasiswa yang belum ada di tabel presensi
    const belumAbsen = targetMahasiswa.filter(m => !sudahAbsenIds.includes(m.id))

    if (belumAbsen.length === 0) {
       return NextResponse.json({ alphaCreated: 0, message: 'Semua mahasiswa sudah memiliki status kehadiran' })
    }

    // 6. Pisahkan mana yang berhak mendapat 'Izin' dan mana yang benar-benar 'Alpha'
    const insertData: any[] = []
    let totalAlphaCounter = 0
    const waktuSekarang = new Date().toISOString()

    belumAbsen.forEach(m => {
      // Jika ID mahasiswa masuk dalam daftar izin sah (Sesi ATAU Pulang)
      if (allApprovedIzinIds.includes(m.id)) {
        insertData.push({
          mahasiswa_id: m.id,
          sesi_id: jadwal_id,
          status: 'izin',
          waktu_absen: waktuSekarang
        })
      } 
      // Jika tidak punya izin sama sekali
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

    // 7. Masukkan semua data ke database sekaligus
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
