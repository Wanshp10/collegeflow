import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout, selectUser } from '../store/slices/authSlice';
import API from '../api/axios';
import toast from 'react-hot-toast';
import type { User, Section, SectionReport, ScannedEntry } from '../types';

type Tab = 'sections' | 'qr' | 'report';

interface QRConfig {
  sectionId: string;
  durationMinutes: number;
  radiusMeters: number;
}

export default function TeacherDashboard() {
  const dispatch = useAppDispatch();
  const user     = useAppSelector(selectUser);

  const [tab, setTab]              = useState<Tab>('sections');
  const [sections, setSections]    = useState<Section[]>([]);
  const [students, setStudents]    = useState<User[]>([]);
  const [qrImage, setQrImage]      = useState<string | null>(null);
  const [sessionId, setSessionId]  = useState<string | null>(null);
  const [activeSession, setActive] = useState(false);
  const [scanned, setScanned]      = useState<ScannedEntry[]>([]);
  const [approved, setApproved]    = useState<string[]>([]);
  const [countdown, setCountdown]  = useState(0);
  const [report, setReport]        = useState<SectionReport | null>(null);
  
  // ── FILTER STATE FOR SECTIONS ──
  const [secFilter, setSecFilter]  = useState({ year: '', sem: '' });

  const [qrConfig, setQRCfg]       = useState<QRConfig>({
    sectionId: '', durationMinutes: 10, radiusMeters: 50,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSections = useCallback(() =>
    API.get<Section[]>('/teacher/sections').then(r => setSections(r.data)), []);
  const fetchStudents = useCallback(() =>
    API.get<User[]>('/teacher/students').then(r => setStudents(r.data)), []);

  useEffect(() => {
    fetchSections();
    fetchStudents();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setCountdown(c => (c <= 1 ? 0 : c - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  const generateQR = () => {
    if (!qrConfig.sectionId) { toast.error('Select a section'); return; }

    const go = async (lat: number | null, lng: number | null) => {
      try {
        const { data } = await API.post<{ sessionId: string; qrImage: string }>(
          '/teacher/qr/generate',
          { ...qrConfig, latitude: lat, longitude: lng },
        );
        setQrImage(data.qrImage);
        setSessionId(data.sessionId);
        setActive(true);
        setCountdown(qrConfig.durationMinutes * 60);
        setTab('qr');
        toast.success('QR Code generated!');
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Error generating QR');
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => go(p.coords.latitude, p.coords.longitude),
        () => go(null, null),
      );
    } else {
      go(null, null);
    }
  };

  const fetchScanned = async () => {
    if (!sessionId) return;
    const { data } = await API.get<{ pending: ScannedEntry[] }>(
      `/teacher/qr/sessions/${sessionId}/pending`,
    );
    setScanned(data.pending);
    setApproved(data.pending.map(p => p.student._id));
  };

  const finalize = async () => {
    if (!sessionId) return;
    try {
      const { data } = await API.post<{ approved: number }>(
        `/teacher/qr/sessions/${sessionId}/finalize`,
        { approvedStudentIds: approved },
      );
      toast.success(`✅ ${data.approved} students marked present!`);
      setActive(false);
      setQrImage(null);
      setSessionId(null);
      setScanned([]);
      setApproved([]);
      setCountdown(0);
      fetchSections();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error finalizing');
    }
  };

  const addStudent = async (secId: string, stuId: string) => {
    try {
      await API.post(`/teacher/sections/${secId}/students`, { studentId: stuId });
      fetchSections();
      toast.success('Student added!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const removeStudent = async (secId: string, stuId: string) => {
    try {
      await API.delete(`/teacher/sections/${secId}/students/${stuId}`);
      fetchSections();
      toast.success('Student removed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const viewReport = async (id: string) => {
    try {
      const { data } = await API.get<SectionReport>(`/teacher/sections/${id}/attendance`);
      setReport(data);
      setTab('report');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error loading report');
    }
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── FILTER SECTIONS ──
  const displaySections = sections.filter(sec => 
    (!secFilter.year || sec.year?.toString() === secFilter.year) &&
    (!secFilter.sem  || sec.semester?.toString() === secFilter.sem)
  );

  return (
    <div style={S.page}>
      {/* ── NAV ── */}
      <nav style={S.nav}>
        <div style={S.brand}>
          📋 AttendEase <span style={S.pill}>Teacher</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['sections', 'qr', 'report'] as Tab[]).map(t => (
            <button key={t} style={tab === t ? S.tabOn : S.tabOff} onClick={() => setTab(t)}>
              {t === 'sections' ? '📚 My Sections' : t === 'qr' ? '📷 QR Code' : '📊 Reports'}
            </button>
          ))}
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>👤 {user?.name}</span>
          <button style={S.logoutBtn} onClick={() => dispatch(logout())}>Logout</button>
        </div>
      </nav>

      <div style={S.container}>

        {/* ── MY SECTIONS ── */}
        {tab === 'sections' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, color: '#1a202c' }}>My Assigned Sections</h2>
                <p style={{ color: '#718096', fontSize: 13, margin: 0 }}>
                  Sections are assigned by your HOD. Contact them to add new sections.
                </p>
              </div>
              
              {/* ── FILTER CONTROLS ── */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select style={S.fInput} value={secFilter.year} onChange={e => setSecFilter({...secFilter, year: e.target.value})}>
                  <option value="">All Years</option>
                  {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <select style={S.fInput} value={secFilter.sem} onChange={e => setSecFilter({...secFilter, sem: e.target.value})}>
                  <option value="">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
                <button style={{ ...S.smBtn, padding: '9px 12px' }} onClick={() => setSecFilter({ year: '', sem: '' })}>↺ Reset</button>
              </div>
            </div>

            {displaySections.length === 0 ? (
              <div style={S.empty}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No sections found.</p>
                <p style={{ fontSize: 13, color: '#9ca3af' }}>Ask your HOD to assign you to a section or clear your filters.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 20 }}>
                {displaySections.map(sec => (
                  <div key={sec._id} style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a202c' }}>{sec.subject}</div>
                        <div style={{ color: '#718096', fontSize: 13, marginTop: 2 }}>
                          {sec.name}{sec.subjectCode ? ` • ${sec.subjectCode}` : ''}
                        </div>
                        {sec.department && (
                          <div style={{ color: '#0891b2', fontSize: 12, marginTop: 2 }}>🏫 {sec.department}</div>
                        )}
                        {sec.year && (
                          <div style={{ color: '#718096', fontSize: 12 }}>Year {sec.year} — Sem {sec.semester}</div>
                        )}
                        {sec.hod && (
                          <div style={{ color: '#059669', fontSize: 12 }}>HOD: {(sec.hod as User).name}</div>
                        )}
                      </div>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {sec.totalClasses} classes
                      </span>
                    </div>

                    <p style={{ color: '#718096', fontSize: 13, margin: '8px 0' }}>
                      👥 {sec.students?.length || 0} students enrolled
                    </p>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <button style={S.smBtn} onClick={() => viewReport(sec._id)}>📊 Report</button>
                      <select
                        style={S.smSel}
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) {
                            addStudent(sec._id, e.target.value);
                            (e.target as HTMLSelectElement).value = '';
                          }
                        }}
                      >
                        <option value="">+ Add Student</option>
                        {students
                          .filter(st => !sec.students?.find((en: any) => en._id === st._id || en === st._id))
                          .map(st => (
                            <option key={st._id} value={st._id}>
                              {st.name} ({st.rollNumber || st.email})
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Enrolled students */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {sec.students?.map((st: any) => (
                        <span
                          key={st._id}
                          style={{ background: '#f0fdf4', color: '#166534', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          {st.name}
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: 13, padding: 0, lineHeight: 1 }}
                            onClick={() => removeStudent(sec._id, st._id)}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── QR CODE ── */}
        {tab === 'qr' && (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {!activeSession ? (
              <div style={S.card}>
                <h2 style={{ margin: '0 0 18px', fontSize: 18 }}>Generate QR Code</h2>
                {sections.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                    <p>No sections assigned. Contact your HOD.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={S.label}>Select Section *</label>
                      <select
                        style={S.input}
                        value={qrConfig.sectionId}
                        onChange={e => setQRCfg(c => ({ ...c, sectionId: e.target.value }))}
                      >
                        <option value="">Choose a section…</option>
                        {sections.map(s => (
                          <option key={s._id} value={s._id}>{s.subject} — {s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={S.label}>Duration (minutes)</label>
                        <input
                          style={S.input}
                          type="number"
                          min={1}
                          max={120}
                          value={qrConfig.durationMinutes}
                          onChange={e => setQRCfg(c => ({ ...c, durationMinutes: +e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={S.label}>Geofence Radius (meters)</label>
                        <input
                          style={S.input}
                          type="number"
                          min={10}
                          max={500}
                          value={qrConfig.radiusMeters}
                          onChange={e => setQRCfg(c => ({ ...c, radiusMeters: +e.target.value }))}
                        />
                      </div>
                    </div>

                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0369a1' }}>
                      📍 Your location will be used for geofencing if permitted by the browser.
                    </div>

                    <button style={S.pBtn} onClick={generateQR}>🔲 Generate QR Code</button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Active QR session */}
                <div style={{ ...S.card, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h2 style={{ margin: 0 }}>Active Session</h2>
                    <div style={{
                      fontSize: 28, fontWeight: 800, fontFamily: 'monospace',
                      color: countdown < 60 ? '#dc2626' : countdown < 180 ? '#f59e0b' : '#059669',
                    }}>
                      ⏱ {fmt(countdown)}
                    </div>
                  </div>

                  {qrImage && (
                    <div style={{ display: 'inline-block', padding: 12, background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      <img src={qrImage} alt="QR Code" style={{ width: 240, height: 240, display: 'block' }} />
                    </div>
                  )}

                  <p style={{ color: '#718096', marginTop: 12 }}>Students scan this QR code to mark attendance</p>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                    <button style={S.pBtn} onClick={fetchScanned}>🔄 Refresh Scans</button>
                  </div>
                </div>

                {/* Scanned list */}
                {scanned.length > 0 && (
                  <div style={S.card}>
                    <h3 style={{ margin: '0 0 8px' }}>Scanned Students ({scanned.length})</h3>
                    <p style={{ color: '#718096', fontSize: 13, marginBottom: 12 }}>
                      Uncheck students to exclude them from attendance.
                    </p>
                    {scanned.map(sc => (
                      <div
                        key={sc.student._id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f4f8' }}
                      >
                        <input
                          type="checkbox"
                          checked={approved.includes(sc.student._id)}
                          onChange={e => setApproved(
                            e.target.checked
                              ? [...approved, sc.student._id]
                              : approved.filter(id => id !== sc.student._id),
                          )}
                        />
                        <strong>{sc.student.name}</strong>
                        <span style={{ color: '#718096', fontSize: 13 }}>{sc.student.rollNumber}</span>
                        <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 12 }}>
                          {new Date(sc.scannedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    <button
                      style={{ ...S.pBtn, background: 'linear-gradient(135deg,#059669,#047857)', marginTop: 14, width: '100%' }}
                      onClick={finalize}
                    >
                      ✅ Finalize Attendance ({approved.length} approved)
                    </button>
                  </div>
                )}

                {scanned.length === 0 && (
                  <div style={{ ...S.card, textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
                    <p>No scans yet. Click "Refresh Scans" after students scan the QR code.</p>
                    <button
                      style={{ ...S.pBtn, background: '#dc2626', marginTop: 14 }}
                      onClick={finalize}
                    >
                      ⏹ End Session Early
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ATTENDANCE REPORT ── */}
        {tab === 'report' && report && (
          <div>
            {/* Alert banner */}
            {report.alerts?.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: '#dc2626', margin: '0 0 8px' }}>⚠️ Low Attendance Alerts</h3>
                {report.alerts.map(a => (
                  <div
                    key={a.student.id}
                    style={{ padding: '6px 0', color: '#7f1d1d', borderBottom: '1px solid #fecaca', fontSize: 14 }}
                  >
                    🚨 <strong>{a.student.name}</strong> ({a.student.rollNumber}) —{' '}
                    <strong>{a.percentage}%</strong> attendance
                  </div>
                ))}
              </div>
            )}

            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: '0 0 4px' }}>{report.section?.subject}</h2>
                  <p style={{ color: '#718096', margin: 0, fontSize: 14 }}>
                    Section: {report.section?.name} &nbsp;•&nbsp; Total Classes: {report.section?.totalClasses}
                  </p>
                </div>
                <button
                  style={{ ...S.smBtn, fontSize: 13 }}
                  onClick={() => { setReport(null); setTab('sections'); }}
                >
                  ← Back
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Student', 'Roll No.', 'Dept', 'Year/Sem', 'Present', 'Total', '%', 'Status'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.attendanceData?.map(row => (
                      <tr key={row.student.id} style={{ ...S.tr, background: row.alert ? '#fff5f5' : 'white' }}>
                        <td style={S.td}><strong>{row.student.name}</strong></td>
                        <td style={S.td}><code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{row.student.rollNumber}</code></td>
                        <td style={S.td}>{row.student.department || '—'}</td>
                        <td style={S.td}>{row.student.year ? `Y${row.student.year} S${row.student.semester}` : '—'}</td>
                        <td style={S.td}>{row.present}</td>
                        <td style={S.td}>{row.total}</td>
                        <td style={S.td}>
                          <div style={{ background: '#e5e7eb', borderRadius: 4, height: 7, width: 70, overflow: 'hidden', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }}>
                            <div style={{
                              height: '100%', borderRadius: 4, width: `${row.percentage}%`,
                              background: row.percentage < 35 ? '#dc2626' : row.percentage < 75 ? '#f59e0b' : '#059669',
                            }} />
                          </div>
                          <span style={{ fontWeight: 600 }}>{row.percentage}%</span>
                        </td>
                        <td style={S.td}>
                          {row.alert
                            ? <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>⚠️ Critical</span>
                            : row.percentage < 75
                              ? <span style={{ background: '#fffbeb', color: '#d97706', borderRadius: 12, padding: '3px 10px', fontSize: 12 }}>⚡ Low</span>
                              : <span style={{ background: '#f0fdf4', color: '#059669', borderRadius: 12, padding: '3px 10px', fontSize: 12 }}>✅ Good</span>
                          }
                        </td>
                      </tr>
                    ))}
                    {report.attendanceData?.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 40 }}>
                          No attendance data yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'report' && !report && (
          <div style={S.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <p style={{ fontWeight: 600 }}>No report selected.</p>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>
              Go to <strong>My Sections</strong> and click 📊 Report on a section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:      { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui,sans-serif' },
  nav:       { background: 'linear-gradient(135deg,#0891b2,#0e7490)', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  brand:     { fontSize: 20, fontWeight: 800 },
  pill:      { background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', fontSize: 11, marginLeft: 8 },
  tabOn:     { background: 'rgba(255,255,255,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  tabOff:    { background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13 },
  logoutBtn: { background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' },
  container: { maxWidth: 1100, margin: '0 auto', padding: '28px 20px' },
  card:      { background: 'white', borderRadius: 12, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  pBtn:      { padding: '10px 20px', background: 'linear-gradient(135deg,#0891b2,#0e7490)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
  smBtn:     { padding: '6px 12px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  smSel:     { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  input:     { width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' },
  label:     { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 600 },
  thead:     { background: '#f7fafc' },
  th:        { padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: 0.5 },
  tr:        { borderBottom: '1px solid #f3f4f6' },
  td:        { padding: '11px 14px', fontSize: 14 },
  fInput:    { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' },
  empty:     { textAlign: 'center', padding: '60px 20px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12 },
};