import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout, selectUser } from '../store/slices/authSlice';
import API from '../api/axios';
import toast from 'react-hot-toast';
import type { StudentAttendance } from '../types';

type Tab = 'attendance' | 'scan';

interface ScanState {
  scanning: boolean;
  result: string | null;
  error: string | null;
}

export default function StudentDashboard() {
  const dispatch = useAppDispatch();
  const user     = useAppSelector(selectUser);

  const [tab, setTab]                = useState<Tab>('attendance');
  const [attendance, setAttendance]  = useState<StudentAttendance[]>([]);
  const [loading, setLoading]        = useState(false);
  const [scanState, setScanState]    = useState<ScanState>({ scanning: false, result: null, error: null });
  const [manualCode, setManualCode]  = useState('');
  const [submitting, setSubmitting]  = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get<StudentAttendance[]>('/student/attendance');
      setAttendance(data);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAttendance(); }, []);

  // Start QR scanner using html5-qrcode
  const startScanner = async () => {
    setScanState({ scanning: true, result: null, error: null });
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          await scanner.stop();
          setScanState(s => ({ ...s, scanning: false }));
          await submitScan(decodedText);
        },
        () => { /* ignore scan errors */ },
      );
    } catch (err: any) {
      setScanState({ scanning: false, result: null, error: 'Camera not available. Use manual entry below.' });
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch { /* ignore */ }
    setScanState(s => ({ ...s, scanning: false }));
  };

  const submitScan = async (rawText: string) => {
    setSubmitting(true);
    try {
      let sessionId = rawText;
      // Try parsing as JSON (QR contains JSON payload)
      try {
        const parsed = JSON.parse(rawText);
        if (parsed.sessionId) sessionId = parsed.sessionId;
      } catch { /* use raw text as sessionId */ }

      const getLocation = (): Promise<{ latitude: number; longitude: number } | null> =>
        new Promise(resolve => {
          if (!navigator.geolocation) { resolve(null); return; }
          navigator.geolocation.getCurrentPosition(
            p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
            () => resolve(null),
          );
        });

      const location = await getLocation();
      await API.post('/student/qr/scan', { sessionId, ...location });
      setScanState({ scanning: false, result: '✅ Scan recorded! Awaiting teacher confirmation.', error: null });
      toast.success('Attendance scan submitted!');
      setManualCode('');
      fetchAttendance();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Scan failed';
      setScanState({ scanning: false, result: null, error: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) { toast.error('Enter a session ID'); return; }
    await submitScan(manualCode.trim());
  };

  // Overall stats
  const totalSubjects  = attendance.length;
  const avgPercentage  = totalSubjects > 0
    ? Math.round(attendance.reduce((sum, a) => sum + a.percentage, 0) / totalSubjects)
    : 0;
  const atRisk   = attendance.filter(a => a.alert).length;
  const lowCount = attendance.filter(a => !a.alert && a.percentage < 75).length;

  const getColor = (pct: number) =>
    pct < 35 ? '#dc2626' : pct < 75 ? '#f59e0b' : '#059669';

  const getGrade = (pct: number) =>
    pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 60 ? 'C' : pct >= 35 ? 'D' : 'F';

  return (
    <div style={S.page}>
      {/* ── NAV ── */}
      <nav style={S.nav}>
        <div style={S.brand}>📋 AttendEase <span style={S.pill}>Student</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={tab === 'attendance' ? S.tabOn : S.tabOff} onClick={() => { stopScanner(); setTab('attendance'); }}>
            📊 My Attendance
          </button>
          <button style={tab === 'scan' ? S.tabOn : S.tabOff} onClick={() => setTab('scan')}>
            📷 Scan QR
          </button>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>🎓 {user?.name}</span>
          <button style={S.logoutBtn} onClick={() => { stopScanner(); dispatch(logout()); }}>Logout</button>
        </div>
      </nav>

      <div style={S.container}>

        {/* ── ATTENDANCE ── */}
        {tab === 'attendance' && (
          <div>
            {/* Summary cards */}
            <div style={S.summaryGrid}>
              <div style={{ ...S.summaryCard, borderTop: '4px solid #7c3aed' }}>
                <div style={{ fontSize: 28 }}>📚</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed' }}>{totalSubjects}</div>
                <div style={{ color: '#718096', fontSize: 12 }}>Subjects</div>
              </div>
              <div style={{ ...S.summaryCard, borderTop: `4px solid ${getColor(avgPercentage)}` }}>
                <div style={{ fontSize: 28 }}>📈</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: getColor(avgPercentage) }}>{avgPercentage}%</div>
                <div style={{ color: '#718096', fontSize: 12 }}>Average</div>
              </div>
              <div style={{ ...S.summaryCard, borderTop: '4px solid #059669' }}>
                <div style={{ fontSize: 28 }}>✅</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>
                  {attendance.filter(a => a.percentage >= 75).length}
                </div>
                <div style={{ color: '#718096', fontSize: 12 }}>Good Standing</div>
              </div>
              <div style={{ ...S.summaryCard, borderTop: '4px solid #dc2626' }}>
                <div style={{ fontSize: 28 }}>⚠️</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626' }}>{atRisk}</div>
                <div style={{ color: '#718096', fontSize: 12 }}>At Risk</div>
              </div>
            </div>

            {/* Alert banner */}
            {atRisk > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🚨</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#dc2626' }}>Critical Attendance Warning</div>
                  <div style={{ color: '#7f1d1d', fontSize: 13 }}>
                    {atRisk} subject(s) have attendance below 35%. Immediate action required.
                  </div>
                </div>
              </div>
            )}

            {lowCount > 0 && atRisk === 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>⚡</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#92400e' }}>Attendance Below 75%</div>
                  <div style={{ color: '#78350f', fontSize: 13 }}>
                    {lowCount} subject(s) need attention. Try to attend more classes.
                  </div>
                </div>
              </div>
            )}

            {/* Subject cards */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Loading attendance…</div>
            ) : attendance.length === 0 ? (
              <div style={S.empty}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ fontWeight: 600 }}>No attendance data yet.</p>
                <p style={{ fontSize: 13, color: '#9ca3af' }}>
                  You'll see data here once you're enrolled in sections and classes begin.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
                {attendance.map(a => {
                  const color   = getColor(a.percentage);
                  const grade   = getGrade(a.percentage);
                  const needed  = a.total > 0
                    ? Math.max(0, Math.ceil(0.75 * a.total) - a.present)
                    : 0;
                  return (
                    <div
                      key={a.section.id}
                      style={{
                        ...S.subjectCard,
                        borderLeft: `4px solid ${color}`,
                        background: a.alert ? '#fff5f5' : 'white',
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>{a.section.subject}</div>
                          <div style={{ color: '#718096', fontSize: 12 }}>
                            {a.section.name}{a.section.subjectCode ? ` • ${a.section.subjectCode}` : ''}
                          </div>
                        </div>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: color + '18', border: `2px solid ${color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 16, color,
                        }}>
                          {grade}
                        </div>
                      </div>

                      {/* Progress ring */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                        <svg width="72" height="72" viewBox="0 0 72 72">
                          <circle cx="36" cy="36" r="28" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                          <circle
                            cx="36" cy="36" r="28"
                            fill="none"
                            stroke={color}
                            strokeWidth="8"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - a.percentage / 100)}`}
                            strokeLinecap="round"
                            transform="rotate(-90 36 36)"
                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                          />
                          <text x="36" y="36" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="800" fill={color}>
                            {a.percentage}%
                          </text>
                        </svg>
                        <div>
                          <div style={{ fontSize: 13, color: '#718096' }}>
                            <span style={{ fontWeight: 700, color: '#1a202c', fontSize: 15 }}>{a.present}</span> / {a.total} classes
                          </div>
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                            {a.total - a.present} absent
                          </div>
                          {a.percentage < 75 && a.total > 0 && (
                            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontWeight: 600 }}>
                              Need {needed} more class{needed !== 1 ? 'es' : ''} for 75%
                            </div>
                          )}
                          {a.percentage >= 75 && (
                            <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>
                              ✓ Above 75% threshold
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 6,
                          width: `${a.percentage}%`,
                          background: `linear-gradient(90deg, ${color}88, ${color})`,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>

                      {/* Status badge */}
                      <div style={{ marginTop: 10 }}>
                        {a.alert
                          ? <span style={{ ...S.badge, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>⚠️ Critical — Below 35%</span>
                          : a.percentage < 75
                            ? <span style={{ ...S.badge, background: '#fffbeb', color: '#d97706', border: '1px solid #fde047' }}>⚡ Low — Below 75%</span>
                            : <span style={{ ...S.badge, background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>✅ Good Standing</span>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SCAN QR ── */}
        {tab === 'scan' && (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20, color: '#1a202c' }}>📷 Scan Attendance QR</h2>

            {/* Success message */}
            {scanState.result && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#166534' }}>Scan Successful!</div>
                  <div style={{ color: '#15803d', fontSize: 13 }}>{scanState.result}</div>
                </div>
              </div>
            )}

            {/* Error message */}
            {scanState.error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>❌</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#dc2626' }}>Scan Failed</div>
                  <div style={{ color: '#991b1b', fontSize: 13 }}>{scanState.error}</div>
                </div>
              </div>
            )}

            {/* Camera scanner */}
            <div style={S.card}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>📸 Camera Scanner</h3>

              {!scanState.scanning ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>📷</div>
                  <p style={{ color: '#718096', fontSize: 14, marginBottom: 16 }}>
                    Point your camera at the QR code displayed by your teacher.
                  </p>
                  <button style={S.pBtn} onClick={startScanner} disabled={submitting}>
                    📷 Open Camera
                  </button>
                </div>
              ) : (
                <div>
                  <div
                    id="qr-reader"
                    ref={scannerDivRef}
                    style={{ width: '100%', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button style={{ ...S.pBtn, background: '#dc2626' }} onClick={stopScanner}>
                      ⏹ Stop Camera
                    </button>
                  </div>
                  <p style={{ textAlign: 'center', color: '#718096', fontSize: 13, marginTop: 10 }}>
                    Scanning… Point at the QR code
                  </p>
                </div>
              )}
            </div>

            {/* Manual entry */}
            <div style={{ ...S.card, marginTop: 16 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>⌨️ Manual Session ID Entry</h3>
              <p style={{ color: '#718096', fontSize: 13, marginBottom: 14 }}>
                If the camera isn't working, ask your teacher for the Session ID.
              </p>
              <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  style={S.input}
                  placeholder="Paste or type Session ID here…"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                />
                <button type="submit" style={S.pBtn} disabled={submitting || !manualCode.trim()}>
                  {submitting ? 'Submitting…' : '✅ Submit Attendance'}
                </button>
              </form>
            </div>

            {/* Info note */}
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 13, color: '#0369a1' }}>
              ℹ️ Your attendance is recorded as <strong>Pending</strong> until the teacher confirms it.
              You'll see the updated percentage after finalization.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:        { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui,sans-serif' },
  nav:         { background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  brand:       { fontSize: 20, fontWeight: 800 },
  pill:        { background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', fontSize: 11, marginLeft: 8 },
  tabOn:       { background: 'rgba(255,255,255,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  tabOff:      { background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13 },
  logoutBtn:   { background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' },
  container:   { maxWidth: 1100, margin: '0 auto', padding: '28px 20px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: 24 },
  summaryCard: { background: 'white', borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  subjectCard: { background: 'white', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  badge:       { display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  card:        { background: 'white', borderRadius: 12, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  pBtn:        { padding: '10px 20px', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', width: '100%' },
  input:       { width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' },
  empty:       { textAlign: 'center', padding: '60px 20px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12 },
};
