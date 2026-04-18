-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_jadwal_updated_at BEFORE UPDATE ON jadwal_kegiatan FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_perizinan_updated_at BEFORE UPDATE ON perizinan FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_spp_updated_at BEFORE UPDATE ON pembayaran_spp FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_pelanggaran_updated_at BEFORE UPDATE ON pelanggaran FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto insert presensi when perizinan approved
CREATE OR REPLACE FUNCTION handle_perizinan_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.jadwal_id IS NOT NULL THEN
    INSERT INTO presensi (mahasiswa_id, jadwal_id, status, waktu_absen)
    VALUES (NEW.mahasiswa_id, NEW.jadwal_id, 'izin', NOW())
    ON CONFLICT (mahasiswa_id, jadwal_id) DO UPDATE SET status = 'izin', waktu_absen = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_perizinan_approval
  AFTER UPDATE ON perizinan
  FOR EACH ROW EXECUTE FUNCTION handle_perizinan_approval();

-- Storage buckets (run in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('permit-photos', 'permit-photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('violation-photos', 'violation-photos', true);
