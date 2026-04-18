-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_kegiatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE presensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE perizinan ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran_spp ENABLE ROW LEVEL SECURITY;
ALTER TABLE pelanggaran ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Pengelola can view all profiles" ON profiles FOR SELECT USING (get_user_role() IN ('pengelola', 'pengurus'));
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Pengelola can update all profiles" ON profiles FOR UPDATE USING (get_user_role() = 'pengelola');
CREATE POLICY "Anyone authenticated can insert profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Jadwal kegiatan
CREATE POLICY "Anyone can view jadwal" ON jadwal_kegiatan FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Pengelola can manage jadwal" ON jadwal_kegiatan FOR ALL USING (get_user_role() = 'pengelola');
CREATE POLICY "Pengurus can manage non-ngaji" ON jadwal_kegiatan FOR ALL USING (get_user_role() = 'pengurus' AND jenis != 'ngaji');

-- Presensi
CREATE POLICY "Mahasiswa can view own presensi" ON presensi FOR SELECT USING (auth.uid() = mahasiswa_id);
CREATE POLICY "Pengelola can view all presensi" ON presensi FOR SELECT USING (get_user_role() = 'pengelola');
CREATE POLICY "Mahasiswa can insert own presensi" ON presensi FOR INSERT WITH CHECK (auth.uid() = mahasiswa_id);
CREATE POLICY "System can upsert presensi" ON presensi FOR UPDATE USING (auth.uid() = mahasiswa_id OR get_user_role() = 'pengelola');

-- Perizinan
CREATE POLICY "Mahasiswa can view own perizinan" ON perizinan FOR SELECT USING (auth.uid() = mahasiswa_id);
CREATE POLICY "Pengelola can view all perizinan" ON perizinan FOR SELECT USING (get_user_role() = 'pengelola');
CREATE POLICY "Mahasiswa can insert own perizinan" ON perizinan FOR INSERT WITH CHECK (auth.uid() = mahasiswa_id);
CREATE POLICY "Pengelola can update perizinan" ON perizinan FOR UPDATE USING (get_user_role() = 'pengelola');

-- Pembayaran SPP
CREATE POLICY "Mahasiswa can view own spp" ON pembayaran_spp FOR SELECT USING (auth.uid() = mahasiswa_id);
CREATE POLICY "Pengelola can view all spp" ON pembayaran_spp FOR SELECT USING (get_user_role() = 'pengelola');
CREATE POLICY "Pengelola can manage spp" ON pembayaran_spp FOR ALL USING (get_user_role() = 'pengelola');
CREATE POLICY "Mahasiswa can update own spp bukti" ON pembayaran_spp FOR UPDATE USING (auth.uid() = mahasiswa_id AND status IN ('belum_bayar', 'ditolak'));

-- Pelanggaran
CREATE POLICY "Mahasiswa can view own pelanggaran" ON pelanggaran FOR SELECT USING (auth.uid() = mahasiswa_id);
CREATE POLICY "Pengurus can view all pelanggaran" ON pelanggaran FOR SELECT USING (get_user_role() IN ('pengurus', 'pengelola'));
CREATE POLICY "Pengurus can manage pelanggaran" ON pelanggaran FOR ALL USING (get_user_role() = 'pengurus');
