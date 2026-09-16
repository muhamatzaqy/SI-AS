// src/app/api/whatsapp/broadcast-jadwal/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  // 1. KEAMANAN: Pastikan yang memanggil API ini adalah Supabase (cocokkan secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Akses Ditolak! Secret tidak valid.' }, { status: 401 })
  }

  try {
    // 2. KONEKSI DATABASE: Gunakan Service Role Key karena ini proses di-background
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Ambil ID Sesi yang dikirim oleh Supabase Cron
    const body = await request.json()
    const sesi_id = body.sesi_id

    if (!sesi_id) {
      return NextResponse.json({ error: "ID Sesi tidak diberikan" }, { status: 400 })
    }

    // 3. AMBIL DATA JADWAL
    const { data: sesi, error: errSesi } = await supabase
      .from('sesi')
      .select('*, nama_kegiatan(nama_kegiatan)')
      .eq('id', sesi_id)
      .single()

    if (errSesi || !sesi) throw new Error("Gagal mengambil data jadwal sesi")

    // 4. AMBIL NOMOR WA TARGET PESERTA
    let query = supabase
      .from('profiles')
      .select('nama, no_telepon')
      .eq('role', 'mahasiswa')
      .not('no_telepon', 'is', null) // Hanya yang punya no HP
      
    // Filter berdasarkan target
    if (sesi.tipe_target === 'unit') {
      query = query.eq('unit', sesi.target_audiens.unit)
    } else if (sesi.tipe_target === 'unit_semester') {
      query = query.eq('unit', sesi.target_audiens.unit).eq('semester', sesi.target_audiens.semester)
    } else if (sesi.tipe_target === 'custom') {
      query = query.in('id', sesi.target_audiens.mahasiswa_ids)
    }

    const { data: users, error: errUsers } = await query

    if (errUsers || !users || users.length === 0) {
      return NextResponse.json({ message: "Tidak ada target audiens dengan no WA valid." })
    }

    // 5. SIAPKAN PESAN DAN NOMOR TARGET UNTUK FONNTE
    const targetNumbers = users.map((u: any) => u.no_telepon).join(',')
    const jamMulai = sesi.jam_mulai.slice(0,5)
    const jamSelesai = sesi.jam_selesai.slice(0,5)
    
    const message = `*REMINDER KEGIATAN ASRAMA* 🕌\n\nAssalamu'alaikum.\nDiingatkan kepada seluruh santri/mahasiswa bahwa kegiatan akan segera dimulai:\n\n📚 *${sesi.nama_kegiatan.nama_kegiatan}*\n⏰ Waktu: ${jamMulai} - ${jamSelesai} WIB\n\nSegera persiapkan diri dan jangan lupa melakukan *Absensi Kehadiran* di aplikasi SI-ASRAMA saat kegiatan berlangsung.\n\n_Pesan otomatis dikirim oleh sistem SI-ASRAMA._`

    const formData = new FormData()
    formData.append('target', targetNumbers)
    formData.append('message', message)
    formData.append('delay', '2') // Jeda 2 detik antar pesan agar tidak diblokir WhatsApp

    // 6. KIRIM KE FONNTE
    const fonnteRes = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': process.env.FONNTE_TOKEN || '' },
      body: formData
    })

    const fonnteData = await fonnteRes.json()
    if (!fonnteData.status) throw new Error(fonnteData.reason || "Fonnte API Error")

    return NextResponse.json({ 
      success: true, 
      message: `Broadcast sukses terkirim ke ${users.length} mahasiswa via Fonnte.` 
    })

  } catch (error: any) {
    console.error("Cron Broadcast Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
