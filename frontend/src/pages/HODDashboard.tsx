import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout, selectUser } from '../store/slices/authSlice';
import API from '../api/axios';
import toast from 'react-hot-toast';
import type { User, Section, OverviewItem } from '../types';

type Tab = 'overview' | 'sections' | 'qr' | 'teachers' | 'students' | 'attendance';

interface NewSec { name: string; subject: string; subjectCode: string; department: string; year: string; semester: string; assignToSelf: boolean; }
interface StudentFilters { search: string; dept: string; year: string; sem: string; roll: string; }
interface Stats { teachers: number; students: number; sections: number; }

export default function HODDashboard() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);

  const [tab, setTab] = useState<Tab>('overview');
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [overview, setOverview] = useState<OverviewItem[]>([]);
  const [stats, setStats] = useState<Stats>({ teachers: 0, students: 0, sections: 0 });
  
  const [teacherDeptFilter, setTDF] = useState<string>('');
  const [filters, setFilt] = useState<StudentFilters>({ search: '', dept: '', year: '', sem: '', roll: '' });
  
  // ── FILTER STATE FOR SECTIONS & ATTENDANCE ──
  const [secFilter, setSecFilter] = useState({ year: '', sem: '' });

  const [showSecModal, setSSM] = useState(false);
  const [assignModal, setAM] = useState<Section | null>(null);
  const [assignTId, setATId] = useState('');
  const [stuModal, setStuModal] = useState<Section | null>(null);
  const [selStu, setSelStu] = useState<string[]>([]);
  
  const [assignDeptForm, setADF] = useState({ userId: '', department: '' });

  const [newSec, setNS] = useState<NewSec>({
    name: '', subject: '', subjectCode: '', department: '',
    year: '', semester: '', assignToSelf: false,
  });

  // ── QR GENERATION STATE ──
  const [qrSectionId, setQrSectionId] = useState('');
  const [qrDuration, setQrDuration]   = useState(10);
  const [qrImage, setQrImage]         = useState<string | null>(null);
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [activeSession, setActive]    = useState(false);
  const [scanned, setScanned]         = useState<any[]>([]);
  const [approved, setApproved]       = useState<string[]>([]);
  const [countdown, setCountdown]     = useState(0);
  const [qrConfig, setQRCfg]          = useState({ sectionId: '', durationMinutes: 10, radiusMeters: 50 });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSections = useCallback(() =>
    API.get<Section[]>('/hod/sections').then(r => setSections(r.data)), []);
  const fetchTeachers = useCallback((dept = '') =>
    API.get<User[]>(`/hod/teachers${dept ? `?filterDept=${dept}` : ''}`).then(r => setTeachers(r.data)), []);
  const fetchStudents = useCallback(() =>
    API.get<User[]>('/hod/students').then(r => setStudents(r.data)), []);
  const fetchOverview = useCallback(() =>
    API.get<OverviewItem[]>('/hod/attendance-overview').then(r => setOverview(r.data)), []);
  const fetchStats = useCallback(() =>
    API.get<Stats>('/hod/stats').then(r => setStats(r.data)), []);

  useEffect(() => {
    fetchSections(); fetchTeachers(); fetchStudents(); fetchStats(); fetchOverview();
  }, [fetchSections, fetchTeachers, fetchStudents, fetchStats, fetchOverview]);

  const setF = (k: keyof StudentFilters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilt(f => ({ ...f, [k]: e.target.value }));

  const fetchFiltered = () => {
    const q = new URLSearchParams();
    if (filters.search) q.set('search', filters.search);
    if (filters.dept)   q.set('dept',   filters.dept);
    if (filters.year)   q.set('year',   filters.year);
    if (filters.sem)    q.set('sem',    filters.sem);
    if (filters.roll)   q.set('roll',   filters.roll);
    API.get<User[]>(`/hod/students?${q.toString()}`).then(r => setStudents(r.data));
  };

  const createSec = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.post('/hod/sections', { ...newSec, year: newSec.year ? Number(newSec.year) : undefined, semester: newSec.semester ? Number(newSec.semester) : undefined });
      toast.success('Section created!');
      setSSM(false); setNS({ name: '', subject: '', subjectCode: '', department: '', year: '', semester: '', assignToSelf: false });
      fetchSections(); fetchStats();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const deleteSec = async (id: string) => {
    if (!confirm('Delete this section?')) return;
    await API.delete(`/hod/sections/${id}`); toast.success('Deleted'); fetchSections(); fetchStats(); fetchOverview();
  };

  const assignTeacher = async () => {
    if (!assignModal || !assignTId) return;
    try {
      await API.put(`/hod/sections/${assignModal._id}/teacher`, { teacherId: assignTId });
      toast.success('Teacher assigned!'); setAM(null); setATId(''); fetchSections();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const assignDeptToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.put(`/hod/teachers/${assignDeptForm.userId}/assign-dept`);
      toast.success(`Teacher added to ${user?.hodDepartment}!`);
      fetchTeachers(teacherDeptFilter); setADF({ userId: '', department: '' });
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error assigning department'); }
  };

  const addStudents = async () => {
    if (!stuModal || selStu.length === 0) return;
    try {
      await API.post(`/hod/sections/${stuModal._id}/students`, { studentIds: selStu });
      toast.success(`${selStu.length} student(s) added!`); setStuModal(null); setSelStu([]); fetchSections(); fetchOverview();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const removeStudent = async (secId: string, stuId: string) => {
    await API.delete(`/hod/sections/${secId}/students/${stuId}`); toast.success('Student removed'); fetchSections(); fetchOverview();
  };

  const toggleStu = (id: string) =>
    setSelStu(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  // ── QR GENERATION LOGIC ──
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
        const { data } = await API.post(
          '/teacher/qr/generate',
          { ...qrConfig, latitude: lat, longitude: lng },
        );
        setQrImage(data.qrImage);
        setSessionId(data.sessionId);
        setActive(true);
        setCountdown(qrConfig.durationMinutes * 60);
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
    try {
      const { data } = await API.get(`/teacher/qr/sessions/${sessionId}/pending`);
      setScanned(data.pending);
      setApproved(data.pending.map((p: any) => p.student._id));
    } catch (err) {}
  };

  const finalizeAttendance = async () => {
    if (!sessionId) return;
    try {
      const { data } = await API.post(
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
      fetchOverview();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error finalizing');
    }
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const uniqueDepts = [...new Set(teachers.map(t => t.department).filter(Boolean))] as string[];

  // ── FILTER DATA FOR SECTIONS AND ATTENDANCE ──
  const displaySections = sections.filter(sec => 
    (!secFilter.year || sec.year?.toString() === secFilter.year) &&
    (!secFilter.sem  || sec.semester?.toString() === secFilter.sem)
  );

  const displayOverview = overview.filter(o => {
    const sec = sections.find(s => s._id === o.section.id);
    return (!secFilter.year || sec?.year?.toString() === secFilter.year) &&
           (!secFilter.sem  || sec?.semester?.toString() === secFilter.sem);
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',   label: '📊 Overview'     },
    { key: 'sections',   label: '📚 Dept Sections'},
    { key: 'qr',         label: '📱 QR Code'      },
    { key: 'attendance', label: '📈 Attendance'   },
    { key: 'teachers',   label: '👨‍🏫 Teachers'    },
    { key: 'students',   label: '🎓 Students'     },
  ];

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={S.brand}>📋 AttendEase <span style={S.pill}>HOD</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>🏛️ {user?.name}</span>
          {user?.hodDepartment && (
            <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: 6, padding: '3px 10px', fontSize: 12 }}>
              {user.hodDepartment}
            </span>
          )}
          <button style={S.logoutBtn} onClick={() => dispatch(logout())}>Logout</button>
        </div>
      </nav>

      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.key} style={tab === t.key ? S.tabOn : S.tabOff} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={S.container}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div style={S.statsGrid}>
              {([
                { l: 'Dept Sections', v: stats.sections, i: '📚', c: '#7c3aed' },
                { l: 'Teachers',    v: stats.teachers, i: '👨‍🏫', c: '#0891b2' },
                { l: 'Students',    v: stats.students, i: '🎓', c: '#059669' },
              ] as { l: string; v: number; i: string; c: string }[]).map(s => (
                <div key={s.l} style={{ ...S.statCard, borderTop: `4px solid ${s.c}` }}>
                  <div style={{ fontSize: 34 }}>{s.i}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ color: '#718096', fontSize: 13 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {overview.filter(o => o.alertCount > 0).map(o => (
              <div key={o.section.id} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 10, fontSize: 14, color: '#991b1b' }}>
                ⚠️ <strong>{o.section.subject} — {o.section.name}</strong> has{' '}
                <strong>{o.alertCount}</strong> student(s) with critical attendance
              </div>
            ))}
            {overview.every(o => o.alertCount === 0) && overview.length > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', color: '#166534', fontSize: 14 }}>
                ✅ All students have satisfactory attendance across all sections.
              </div>
            )}
          </div>
        )}

        {/* DEPARTMENT SECTIONS */}
        {tab === 'sections' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ ...S.h2, margin: 0 }}>Department Sections</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select style={S.fInput} value={secFilter.year} onChange={e => setSecFilter({...secFilter, year: e.target.value})}>
                  <option value="">All Years</option>
                  {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <select style={S.fInput} value={secFilter.sem} onChange={e => setSecFilter({...secFilter, sem: e.target.value})}>
                  <option value="">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
                <button style={{ ...S.secBtn, padding: '9px 12px' }} onClick={() => setSecFilter({ year: '', sem: '' })}>↺ Reset</button>
                <button style={{ ...S.pBtn, padding: '9px 14px' }} onClick={() => setSSM(true)}>+ New Section</button>
              </div>
            </div>

            {displaySections.length === 0 ? (
              <div style={S.empty}>No sections found for these filters.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 20 }}>
                {displaySections.map(sec => (
                  <div key={sec._id} style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{sec.subject}</div>
                        <div style={{ color: '#718096', fontSize: 13 }}>
                          {sec.name}{sec.subjectCode ? ` • ${sec.subjectCode}` : ''}
                        </div>
                        {sec.department && (
                          <div style={{ color: '#7c3aed', fontSize: 12, marginTop: 2 }}>🏫 {sec.department}</div>
                        )}
                        {sec.year && (
                          <div style={{ color: '#718096', fontSize: 12 }}>Year {sec.year} — Sem {sec.semester}</div>
                        )}
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}
                        onClick={() => deleteSec(sec._id)}
                      >
                        🗑️
                      </button>
                    </div>

                    <div style={{ margin: '10px 0', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                      {sec.teacher
                        ? <span>👨‍🏫 <strong>{(sec.teacher as User).name}</strong></span>
                        : <span style={{ color: '#9ca3af' }}>No teacher assigned</span>
                      }
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      <button style={S.smBtn} onClick={() => { setAM(sec); setATId(''); }}>
                        👨‍🏫 Assign Teacher
                      </button>
                      <button style={S.smBtn} onClick={() => { setStuModal(sec); setSelStu([]); }}>
                        + Students
                      </button>
                    </div>

                    <p style={{ color: '#718096', fontSize: 12, margin: '0 0 6px' }}>
                      👥 {sec.students?.length || 0} students • {sec.totalClasses} classes
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {sec.students?.map((st: any) => (
                        <span
                          key={st._id}
                          style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          {st.name}
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: 13, padding: 0 }}
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

        {/* ── QR CODE TAB ── */}
        {tab === 'qr' && (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {!activeSession ? (
              <div style={S.card}>
                <h2 style={{ margin: '0 0 18px', fontSize: 18 }}>Generate QR Code</h2>
                {sections.filter(s => (s.teacher as User)?._id === user?._id).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                    <p>You aren't teaching any sections right now.</p>
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
                        {sections.filter(s => (s.teacher as User)?._id === user?._id).map(s => (
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
                    <button style={{ ...S.pBtn, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }} onClick={fetchScanned}>
                      🔄 Refresh Scans
                    </button>
                  </div>
                </div>

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
                      onClick={finalizeAttendance}
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
                      onClick={finalizeAttendance}
                    >
                      ⏹ End Session Early
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {tab === 'attendance' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ ...S.h2, margin: 0 }}>Department Attendance Overview</h2>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select style={S.fInput} value={secFilter.year} onChange={e => setSecFilter({...secFilter, year: e.target.value})}>
                  <option value="">All Years</option>
                  {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <select style={S.fInput} value={secFilter.sem} onChange={e => setSecFilter({...secFilter, sem: e.target.value})}>
                  <option value="">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
                <button style={{ ...S.secBtn, padding: '9px 12px' }} onClick={() => setSecFilter({ year: '', sem: '' })}>↺ Reset</button>
              </div>
            </div>

            {displayOverview.length === 0 ? (
              <div style={S.empty}>No attendance data found for these filters.</div>
            ) : (
              displayOverview.map(o => (
                <div key={o.section.id} style={{ ...S.card, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{o.section.subject} — {o.section.name}</div>
                      {o.teacher && (
                        <div style={{ color: '#718096', fontSize: 13 }}>👨‍🏫 {o.teacher.name}</div>
                      )}
                    </div>
                    {o.alertCount > 0 && (
                      <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                        ⚠️ {o.alertCount} alerts
                      </span>
                    )}
                  </div>

                  <div style={S.tableCard}>
                    <table style={S.table}>
                      <thead>
                        <tr style={S.thead}>
                          {['Student', 'Roll No.', 'Present', 'Total', '%', 'Status'].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {o.studentReports.map(r => (
                          <tr key={r.student.id} style={{ ...S.tr, background: r.alert ? '#fff5f5' : 'white' }}>
                            <td style={S.td}>{r.student.name}</td>
                            <td style={S.td}>{r.student.rollNumber}</td>
                            <td style={S.td}>{r.present}</td>
                            <td style={S.td}>{r.total}</td>
                            <td style={S.td}>
                              <div style={{ background: '#e5e7eb', borderRadius: 4, height: 7, width: 80, overflow: 'hidden', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }}>
                                <div style={{
                                  height: '100%', borderRadius: 4, width: `${r.percentage}%`,
                                  background: r.percentage < 35 ? '#dc2626' : r.percentage < 75 ? '#f59e0b' : '#059669',
                                }} />
                              </div>
                              {r.percentage}%
                            </td>
                            <td style={S.td}>
                              {r.alert
                                ? <span style={{ ...S.chip, background: '#fef2f2', color: '#dc2626' }}>⚠️ Critical</span>
                                : r.percentage < 75
                                  ? <span style={{ ...S.chip, background: '#fffbeb', color: '#d97706' }}>⚡ Low</span>
                                  : <span style={{ ...S.chip, background: '#f0fdf4', color: '#059669' }}>✅ Good</span>
                              }
                            </td>
                          </tr>
                        ))}
                        {o.studentReports.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                              No students enrolled
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TEACHERS */}
        {tab === 'teachers' && (
          <div>
            <h2 style={S.h2}>Department Teachers</h2>

            <div style={{ ...S.card, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
                👨‍🏫 Add Teacher to {user?.hodDepartment || 'Your Department'}
              </h3>
              <form onSubmit={assignDeptToTeacher} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={S.label}>Select Teacher</label>
                  <select style={S.input} value={assignDeptForm.userId} onChange={e => setADF(f => ({ ...f, userId: e.target.value }))} required>
                    <option value="">Choose teacher...</option>
                    {teachers.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.email}) — {t.department ? `Currently in ${t.department}` : '🔓 No Dept'}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" style={S.pBtn}>+ Add to My Department</button>
              </form>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'All (Dept + Unassigned)', value: '' },
                { label: 'No Department', value: 'unassigned' },
                ...uniqueDepts.map(d => ({ label: d, value: d })),
              ].map(opt => (
                <button
                  key={opt.value}
                  style={{
                    ...S.smBtn,
                    ...(teacherDeptFilter === opt.value
                      ? { background: '#7c3aed', color: 'white', border: '1px solid #7c3aed' }
                      : {}),
                  }}
                  onClick={() => { setTDF(opt.value); fetchTeachers(opt.value); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p style={{ color: '#718096', fontSize: 13, marginBottom: 10 }}>{teachers.length} teacher(s)</p>

            <div style={S.tableCard}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Name', 'Email', 'Department', 'Status', 'Assigned Sections'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(t => {
                    const assigned = sections.filter(s => (s.teacher as User)?._id === t._id);
                    return (
                      <tr key={t._id} style={S.tr}>
                        <td style={S.td}><strong>{t.name}</strong></td>
                        <td style={S.td}>{t.email}</td>
                        <td style={S.td}>
                          {t.department
                            ? <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{t.department}</span>
                            : <span style={{ color: '#9ca3af', fontSize: 12 }}>Not assigned</span>
                          }
                        </td>
                        <td style={S.td}>
                          <span style={{ ...S.chip, background: t.isActive ? '#d1fae5' : '#fee2e2', color: t.isActive ? '#065f46' : '#991b1b' }}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={S.td}>
                          {assigned.length === 0
                            ? <span style={{ color: '#9ca3af' }}>None</span>
                            : assigned.map(s => (
                                <span key={s._id} style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 6, padding: '2px 8px', fontSize: 12, marginRight: 4, display: 'inline-block' }}>
                                  {s.subject}
                                </span>
                              ))
                          }
                        </td>
                      </tr>
                    );
                  })}
                  {teachers.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 40 }}>
                        No teachers found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STUDENTS */}
        {tab === 'students' && (
          <div>
            <h2 style={S.h2}>Department Students</h2>
            <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <input style={S.fInput} placeholder="🔍 Name / roll / email" value={filters.search} onChange={setF('search')} />
              <input style={S.fInput} placeholder="Department" value={filters.dept} onChange={setF('dept')} />
              <select style={S.fInput} value={filters.year} onChange={setF('year')}>
                <option value="">All Years</option>
                {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
              <select style={S.fInput} value={filters.sem} onChange={setF('sem')}>
                <option value="">All Sems</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
              <input style={S.fInput} placeholder="Roll No." value={filters.roll} onChange={setF('roll')} />
              <button style={S.pBtn} onClick={fetchFiltered}>🔍 Filter</button>
              <button style={S.secBtn} onClick={() => { setFilt({ search: '', dept: '', year: '', sem: '', roll: '' }); fetchStudents(); }}>
                ↺ Reset
              </button>
            </div>

            <p style={{ color: '#718096', fontSize: 13, marginBottom: 10 }}>{students.length} student(s)</p>

            <div style={S.tableCard}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Name', 'Roll No.', 'Email', 'Department', 'Year', 'Sem'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map(st => (
                    <tr key={st._id} style={S.tr}>
                      <td style={S.td}><strong>{st.name}</strong></td>
                      <td style={S.td}>
                        <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{st.rollNumber}</code>
                      </td>
                      <td style={S.td}>{st.email}</td>
                      <td style={S.td}>{st.department || '—'}</td>
                      <td style={S.td}>{st.year || '—'}</td>
                      <td style={S.td}>{st.semester || '—'}</td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 40 }}>
                        No students found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CREATE SECTION MODAL */}
      {showSecModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0 }}>Create Section</h2>
              <button style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }} onClick={() => setSSM(false)}>×</button>
            </div>
            <form onSubmit={createSec} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={S.label}>Section Name *</label>
                  <input style={S.input} placeholder="CS-A" value={newSec.name} onChange={e => setNS(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={S.label}>Subject *</label>
                  <input style={S.input} placeholder="Data Structures" value={newSec.subject} onChange={e => setNS(f => ({ ...f, subject: e.target.value }))} required />
                </div>
                <div>
                  <label style={S.label}>Subject Code</label>
                  <input style={S.input} placeholder="CS301" value={newSec.subjectCode} onChange={e => setNS(f => ({ ...f, subjectCode: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Department</label>
                  <input style={S.input} placeholder="Computer Science" value={newSec.department} onChange={e => setNS(f => ({ ...f, department: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Year</label>
                  <select style={S.input} value={newSec.year} onChange={e => setNS(f => ({ ...f, year: e.target.value }))}>
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Semester</label>
                  <select style={S.input} value={newSec.semester} onChange={e => setNS(f => ({ ...f, semester: e.target.value }))}>
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                  </select>
                </div>
              </div>

              {/* Assign to myself toggle */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                background: newSec.assignToSelf ? '#f0fdf4' : '#f9fafb',
                border: `1.5px solid ${newSec.assignToSelf ? '#86efac' : '#e5e7eb'}`,
                borderRadius: 8, padding: '10px 14px', userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={newSec.assignToSelf}
                  onChange={e => setNS(f => ({ ...f, assignToSelf: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: newSec.assignToSelf ? '#166534' : '#374151' }}>
                    🏛️ Assign to myself
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
                    I (HOD) will take attendance for this section directly
                  </div>
                </div>
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="submit" style={S.pBtn}>Create Section</button>
                <button type="button" style={S.secBtn} onClick={() => setSSM(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN TEACHER MODAL */}
      {assignModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Assign Teacher</h2>
              <button style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }} onClick={() => { setAM(null); setATId(''); }}>×</button>
            </div>
            <p style={{ color: '#718096', marginBottom: 14 }}>
              Section: <strong>{assignModal.subject} — {assignModal.name}</strong>
            </p>
            <label style={S.label}>Teacher</label>
            <select style={{ ...S.input, marginBottom: 16 }} value={assignTId} onChange={e => setATId(e.target.value)}>
              <option value="">Choose a teacher…</option>
              {teachers.map(t => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.email}){t.department ? ` — ${t.department}` : ' — No dept'}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={S.pBtn} onClick={assignTeacher}>Assign</button>
              <button style={S.secBtn} onClick={() => { setAM(null); setATId(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENTS MODAL */}
      {stuModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>Add Students</h2>
              <button style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }} onClick={() => { setStuModal(null); setSelStu([]); }}>×</button>
            </div>
            <p style={{ color: '#718096', marginBottom: 12 }}>
              <strong>{stuModal.subject} — {stuModal.name}</strong>
            </p>

            <input
              style={{ ...S.input, marginBottom: 12 }}
              placeholder="🔍 Search name or roll number…"
              onChange={async e => {
                if (e.target.value.length < 2) { fetchStudents(); return; }
                const { data } = await API.get<User[]>(`/hod/students?search=${e.target.value}`);
                setStudents(data);
              }}
            />

            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              {students
                .filter(st => !stuModal.students?.find((s: any) => s._id === st._id || s === st._id))
                .map(st => (
                  <label
                    key={st._id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={selStu.includes(st._id)}
                      onChange={() => toggleStu(st._id)}
                    />
                    <div>
                      <strong>{st.name}</strong>
                      <span style={{ color: '#718096', fontSize: 12, marginLeft: 8 }}>{st.rollNumber}</span>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
                      Y{st.year} S{st.semester}
                    </span>
                  </label>
                ))
              }
              {students.filter(st => !stuModal.students?.find((s: any) => s._id === st._id || s === st._id)).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>All available students are already enrolled</div>
              )}
            </div>

            <p style={{ fontSize: 13, color: '#718096', margin: '8px 0' }}>{selStu.length} selected</p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...S.pBtn, opacity: selStu.length === 0 ? 0.5 : 1 }} onClick={addStudents} disabled={selStu.length === 0}>
                + Add {selStu.length} Student(s)
              </button>
              <button style={S.secBtn} onClick={() => { setStuModal(null); setSelStu([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:      { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui,sans-serif' },
  nav:       { background: 'linear-gradient(135deg,#7c3aed,#9333ea)', color: 'white', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brand:     { fontSize: 20, fontWeight: 800 },
  pill:      { background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', fontSize: 11, marginLeft: 8 },
  logoutBtn: { background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' },
  tabBar:    { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex', gap: 4, overflowX: 'auto' },
  tabOn:     { padding: '14px 16px', background: 'none', border: 'none', borderBottom: '3px solid #7c3aed', color: '#7c3aed', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13 },
  tabOff:    { padding: '14px 16px', background: 'none', border: 'none', borderBottom: '3px solid transparent', color: '#718096', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13 },
  container: { maxWidth: 1200, margin: '0 auto', padding: '28px 20px' },
  h2:        { margin: '0 0 20px', fontSize: 20, color: '#1a202c' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20, marginBottom: 24 },
  statCard:  { background: 'white', borderRadius: 12, padding: 24, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  card:      { background: 'white', borderRadius: 14, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  tableCard: { background: 'white', borderRadius: 12, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 500 },
  thead:     { background: '#fafafa' },
  th:        { padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: 0.5 },
  tr:        { borderBottom: '1px solid #f3f4f6' },
  td:        { padding: '12px 14px', fontSize: 14 },
  chip:      { display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500 },
  pBtn:      { padding: '10px 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  secBtn:    { padding: '10px 18px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  smBtn:     { padding: '5px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  fInput:    { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' },
  empty:     { textAlign: 'center', padding: '48px 20px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12, fontSize: 15 },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  modal:     { background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' },
  label:     { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 },
  input:     { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' },
};