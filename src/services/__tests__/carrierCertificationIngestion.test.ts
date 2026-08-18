// Exercises the certificate ingestion path (uploadCarrierCertification): storage upload +
// carrier_certifications insert. This does NOT use any real carrier certificate data — per
// instruction, JSON payloads that were uploaded for this feature are test fixtures for
// validating the pipeline's schema handling, not confirmed real credentials for Blue Dart, SF
// Express, or Aramex, and must never be inserted as if they were. Every value below is
// synthetic and clearly labeled as a fixture.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadMock = vi.fn();
const insertMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: (_bucket: string) => ({ upload: uploadMock }),
    },
    from: (_table: string) => ({ insert: insertMock }),
  }),
}));

// A synthetic fixture standing in for the "JSON payload" shape used to validate the ingestion
// pipeline's schema handling — not a real certificate, not tied to any real carrier account.
const FIXTURE_CERT_PAYLOAD = {
  carrierId: 'CARR-TEST-FIXTURE-000',
  documentType: 'GDP Certificate' as const,
  fileName: 'test-fixture-gdp-cert.pdf',
  uploadedBy: 'usr-test-fixture-uploader',
};

function makeFixtureFile(name: string): File {
  return { name } as unknown as File;
}

describe('uploadCarrierCertification (certificate ingestion path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
  });

  it('namespaces the storage path by carrier_id and preserves the original filename', async () => {
    const { uploadCarrierCertification } = await import('../supabaseService');
    await uploadCarrierCertification(
      FIXTURE_CERT_PAYLOAD.carrierId,
      makeFixtureFile(FIXTURE_CERT_PAYLOAD.fileName),
      FIXTURE_CERT_PAYLOAD.documentType,
      FIXTURE_CERT_PAYLOAD.uploadedBy
    );

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [storagePath] = uploadMock.mock.calls[0];
    expect(storagePath.startsWith(`${FIXTURE_CERT_PAYLOAD.carrierId}/`)).toBe(true);
    expect(storagePath.endsWith(FIXTURE_CERT_PAYLOAD.fileName)).toBe(true);
  });

  it('always inserts as Pending Review, regardless of input — nothing self-verifies through this path', async () => {
    const { uploadCarrierCertification } = await import('../supabaseService');
    await uploadCarrierCertification(
      FIXTURE_CERT_PAYLOAD.carrierId,
      makeFixtureFile(FIXTURE_CERT_PAYLOAD.fileName),
      FIXTURE_CERT_PAYLOAD.documentType,
      FIXTURE_CERT_PAYLOAD.uploadedBy
    );

    expect(insertMock).toHaveBeenCalledTimes(1);
    const [row] = insertMock.mock.calls[0];
    expect(row.status).toBe('Pending Review');
    expect(row.carrier_id).toBe(FIXTURE_CERT_PAYLOAD.carrierId);
    expect(row.document_type).toBe(FIXTURE_CERT_PAYLOAD.documentType);
    expect(row.uploaded_by).toBe(FIXTURE_CERT_PAYLOAD.uploadedBy);
  });

  it('does not attempt the DB insert when the storage upload fails — no row without a real file behind it', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'fixture: simulated storage failure' } });
    const { uploadCarrierCertification } = await import('../supabaseService');

    const result = await uploadCarrierCertification(
      FIXTURE_CERT_PAYLOAD.carrierId,
      makeFixtureFile(FIXTURE_CERT_PAYLOAD.fileName),
      FIXTURE_CERT_PAYLOAD.documentType,
      FIXTURE_CERT_PAYLOAD.uploadedBy
    );

    expect(result.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
