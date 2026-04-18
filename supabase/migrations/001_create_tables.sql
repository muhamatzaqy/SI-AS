-- Tabel profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  nim TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('mahad_aly', 'lkim')),
  angkatan INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'mahasiswa' CHECK (role IN ('pengelola', 'pengurus', 'mahasiswa')),
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel jadwal_kegiatan
CREATE TABLE jadwal_kegiatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kegiatan TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('ngaji', 'kegiatan_pengurus', 'roan', 'lainnya')),
  target_unit TEXT NOT NULL CHECK (target_unit IN ('mahad_aly', 'lkim', 'gabungan')),
  tanggal DATE NOT NULL,
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  batas_absen TIME,
  wajib_foto BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel presensi
CREATE TABLE presensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mahasiswa_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  jadwal_id UUID REFERENCES jadwal_kegiatan(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'alpha')),
  waktu_absen TIMESTAMPTZ,
  foto_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mahasiswa_id, jadwal_id)
);

-- Tabel perizinan
CREATE TABLE perizinan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mahasiswa_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  jadwal_id UUID REFERENCES jadwal_kegiatan(id),
  jenis_izin TEXT NOT NULL CHECK (jenis_izin IN ('sakit', 'keperluan_keluarga', 'akademik', 'lainnya')),
  keterangan TEXT,
  bukti_foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  catatan_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel pembayaran_spp
CREATE TABLE pembayaran_spp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mahasiswa_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  semester TEXT NOT NULL,
  nominal BIGINT NOT NULL,
  bukti_bayar_url TEXT,
  status TEXT NOT NULL DEFAULT 'belum_bayar' CHECK (status IN ('belum_bayar', 'menunggu_verifikasi', 'lunas', 'ditolak')),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel pelanggaran
CREATE TABLE pelanggaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mahasiswa_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nama_pelanggaran TEXT NOT NULL,
  poin INTEGER NOT NULL DEFAULT 0,
  bukti_foto_url TEXT,
  keterangan TEXT,
  sanksi TEXT,
  sudah_dijalankan BOOLEAN DEFAULT false,
  dicatat_oleh UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_presensi_mahasiswa ON presensi(mahasiswa_id);
CREATE INDEX idx_presensi_jadwal ON presensi(jadwal_id);
CREATE INDEX idx_jadwal_tanggal ON jadwal_kegiatan(tanggal);
CREATE INDEX idx_perizinan_mahasiswa ON perizinan(mahasiswa_id);
CREATE INDEX idx_perizinan_status ON perizinan(status);
CREATE INDEX idx_pembayaran_mahasiswa ON pembayaran_spp(mahasiswa_id);
CREATE INDEX idx_pelanggaran_mahasiswa ON pelanggaran(mahasiswa_id);
