import React, { useEffect, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout, selectUser } from '../store/slices/authSlice';
import API from '../api/axios';
import toast from 'react-hot-toast';
import type { User, AdminStats, AdminRequest, CollegeCodeInfo, UserRole, Section, OverviewItem } from '../types';

type Tab = 'overview' | 'sections' | 'qr' | 'attendance' | 'users' | 'pending' | 'adminReqs' | 'hod' | 'code';
const RC: Record<UserRole, string> = { admin:'#7c3aed', hod:'#dc2626', teacher:'#0891b2', student:'#059669' };

interface NewUser { name:string; email:string; password:string; role:UserRole; rollNumber:string; department:string; year:string; semester:string }

const DEPARTMENTS = [
  'Computer Science', 'AI & DS', 'IT', 'Chemical', 
  'Mechanical', 'Civil', 'Electrical', 'Electronics'
];

export default function AdminDashboard() {
  const dispatch = useAppDispatch();
  const user     = useAppSelector(selectUser);

  const [tab,  setTab]  = useState<Tab>('overview');
  const [users, setUsers]         = useState<User[]>([]);
  const [sections, setSections]   = useState<Section[]>([]);
  const [overview, setOverview]   = useState<OverviewItem[]>([]);
  const [pending, setPend]        = useState<User[]>([]);
  const [adminReqs, setAReqs]     = useState<AdminRequest[]>([]);
  const [stats, setStats]         = useState<AdminStats>({ total:0, students:0, teachers:0, hods:0, admins:0, pending:0, adminReqs:0 });
  const [codeDoc, setCD]          = useState<CollegeCodeInfo>({ exists:false, code:'', collegeName:'' });
  const [codeForm, setCF]         = useState({ code:'', collegeName:'' });
  const [search, setSearch]       = useState('');
  const [roleF, setRoleF]         = useState<string>('all');
  
  // ── FILTER STATE FOR SECTIONS & ATTENDANCE ──
  const [secFilter, setSecFilter] = useState({ year: '', sem: '' });

  const [addModal, setAdd]        = useState(false);
  const [showSecModal, setSSM]    = useState(false);
  
  const [rejectModal, setRM]      = useState<User | null>(null);
  const [rejectReason, setRR]     = useState('');
  const [hodForm, setHF]          = useState({ userId:'', department:'' });
  const [rejectReqModal, setRRM]  = useState<AdminRequest | null>(null);
  const [rejectReqReason, setRRR] = useState('');
  
  const [newUser, setNU] = useState<NewUser>({ name:'', email:'', password:'', role:'student', rollNumber:'', department:'', year:'', semester:'' });
  const [newSec, setNS]  = useState({ name:'', subject:'', subjectCode:'', department:'', year:'', semester:'' });

  // ── STUDENT ASSIGNMENT STATE ──
  const [stuModal, setStuModal]   = useState<Section | null>(null);
  const [selStu, setSelStu]       = useState<string[]>([]);
  const [stuSearch, setStuSearch] = useState('');

  // ── QR GENERATION STATE ──
  const [qrImage, setQrImage]         = useState<string | null>(null);
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [activeSession, setActive]    = useState(false);
  const [scanned, setScanned]         = useState<any[]>([]);
  const [approved, setApproved]       = useState<string[]>([]);
  const [countdown, setCountdown]     = useState(0);
  const [qrConfig, setQRCfg]          = useState({ sectionId: '', durationMinutes: 10, radiusMeters: 50 });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { all(); }, []);

  const all           = () => { fetchUsers(); fetchStats(); fetchPending(); fetchCode(); fetchAdminReqs(); fetchSections(); fetchOverview(); };
  const fetchUsers    = () => API.get<User[]>('/admin/users').then(r => setUsers(r.data));
  const fetchStats    = () => API.get<AdminStats>('/admin/stats').then(r => setStats(r.data));
  const fetchPending  = () => API.get<User[]>('/admin/pending-users').then(r => setPend(r.data));
  const fetchCode     = () => API.get<CollegeCodeInfo>('/admin/college-code').then(r => { setCD(r.data); setCF({ code:r.data.code||'', collegeName:r.data.collegeName||'' }); });
  const fetchAdminReqs= () => API.get<AdminRequest[]>('/admin/admin-requests').then(r => setAReqs(r.data));
  const fetchSections = () => API.get<Section[]>('/admin/sections').then(r => setSections(r.data));
  const fetchOverview = () => API.get<OverviewItem[]>('/admin/attendance-overview').then(r => setOverview(r.data));

  const changeRole = async (id: string, role: UserRole) => { await API.put(`/admin/users/${id}/role`, { role }); toast.success('Role updated'); all(); };
  const toggle     = async (id: string) => { await API.put(`/admin/users/${id}/toggle`); fetchUsers(); };
  const del        = async (id: string) => { if (!confirm('Delete this user?')) return; await API.delete(`/admin/users/${id}`); toast.success('Deleted'); all(); };
  const approve    = async (id: string) => { await API.put(`/admin/approve/${id}`); toast.success('Approved!'); all(); };
  const reject     = async () => { if (!rejectModal) return; await API.put(`/admin/reject/${rejectModal._id}`, { reason: rejectReason }); toast.success('Rejected'); setRM(null); setRR(''); all(); };
  const saveCode   = async (e: React.FormEvent) => { e.preventDefault(); try { await API.put('/admin/college-code', codeForm); toast.success('Code updated!'); fetchCode(); } catch (err: any) { toast.error(err.response?.data?.message||'Error'); } };
  const assignHOD  = async (e: React.FormEvent) => { e.preventDefault(); try { await API.put(`/admin/users/${hodForm.userId}/assign-hod`, { department: hodForm.department }); toast.success('HOD assigned!'); all(); setHF({ userId:'', department:'' }); } catch (err: any) { toast.error(err.response?.data?.message||'Error'); } };
  const createUser = async (e: React.FormEvent) => { e.preventDefault(); try { await API.post('/admin/users', { ...newUser, year:Number(newUser.year)||undefined, semester:Number(newUser.semester)||undefined }); toast.success('User created!'); setAdd(false); all(); } catch (err: any) { toast.error(err.response?.data?.message||'Error'); } };
  const approveAdminReq = async (id: string) => { try { await API.put(`/admin/admin-requests/${id}/approve`); toast.success('Admin access granted!'); all(); } catch (err: any) { toast.error(err.response?.data?.message||'Error'); } };
  const rejectAdminReq  = async () => { if (!rejectReqModal) return; try { await API.put(`/admin/admin-requests/${rejectReqModal._id}/reject`, { reason: rejectReqReason }); toast.success('Request rejected'); setRRM(null); setRRR(''); all(); } catch (err: any) { toast.error(err.response?.data?.message||'Error'); } };

  const createSec = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.post('/admin/sections', { ...newSec, year:Number(newSec.year)||undefined, semester:Number(newSec.semester)||undefined });
      toast.success('Section created!');
      setSSM(false); setNS({ name:'', subject:'', subjectCode:'', department:'', year:'', semester:'' });
      fetchSections();
    } catch(err:any) { toast.error(err.response?.data?.message||'Error'); }
  };

  const deleteSec = async (id: string) => {
    if(!confirm('Delete this section?')) return;
    await API.delete(`/admin/sections/${id}`); toast.success('Deleted'); fetchSections(); fetchOverview();
  };

  // ── STUDENT ASSIGNMENT LOGIC ──
  const addStudents = async () => {
    if (!stuModal || selStu.length === 0) return;
    try {
      await API.post(`/admin/sections/${stuModal._id}/students`, { studentIds: selStu });
      toast.success(`${selStu.length} student(s) added!`);
      setStuModal(null); setSelStu([]); setStuSearch(''); fetchSections(); fetchOverview();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const removeStudent = async (secId: string, stuId: string) => {
    try {
      await API.delete(`/admin/sections/${secId}/students/${stuId}`);
      toast.success('Student removed'); fetchSections(); fetchOverview();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error removing student'); }
  };

  const toggleStu = (id: string) => setSelStu(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

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
      all();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error finalizing');
    }
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const filtered = users.filter(u =>
    (roleF === 'all' || u.role === roleF) &&
    [u.name, u.email, u.rollNumber||''].some(v => v.toLowerCase().includes(search.toLowerCase()))
  );
  
  const availableStudents = users.filter(u => 
    u.role === 'student' && 
    (u.name.toLowerCase().includes(stuSearch.toLowerCase()) || (u.rollNumber||'').toLowerCase().includes(stuSearch.toLowerCase()))
  );

  const pendingAdminReqs = adminReqs.filter(r => r.status === 'pending');

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
    { key:'overview',  label:'📊 Overview'       },
    { key:'sections',  label:'👨‍🏫 My Sections'   },
    { key:'qr',        label:'📱 QR Code'        },
    { key:'attendance',label:'📈 Attendance'     },
    { key:'users',     label:'👥 All Users'      },
    { key:'pending',   label:'⏳ Pending'        },
    { key:'adminReqs', label:'🔑 Admin Requests' },
    { key:'hod',       label:'🏛️ HOD Setup'     },
    { key:'code',      label:'🔑 College Code'   },
  ];

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={S.brand}>📋 AttendEase <span style={S.pill}>Admin</span></div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          {(pending.length + pendingAdminReqs.length) > 0 && (
            <span style={S.badge}>🔔 {pending.length + pendingAdminReqs.length}</span>
          )}
          <span style={{ color:'rgba(255,255,255,0.8)', fontSize:13 }}>👑 {user?.name}</span>
          {user?.adminCollegeCode && (
            <span style={{ background:'rgba(255,255,255,0.15)', color:'white', borderRadius:6, padding:'4px 10px', fontSize:12, fontFamily:'monospace', fontWeight:700 }}>
              🔑 {user.adminCollegeCode}
            </span>
          )}
          <button style={S.logoutBtn} onClick={() => dispatch(logout())}>Logout</button>
        </div>
      </nav>

      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.key} style={tab===t.key ? S.tabOn : S.tabOff} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key==='pending'   && pending.length>0          && <span style={S.tbadge}>{pending.length}</span>}
            {t.key==='adminReqs' && pendingAdminReqs.length>0 && <span style={{ ...S.tbadge, background:'#dc2626' }}>{pendingAdminReqs.length}</span>}
          </button>
        ))}
      </div>

      <div style={S.container}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div style={S.statsGrid}>
              {([
                { l:'Total',          v:stats.total,     i:'👥', c:'#667eea' },
                { l:'Students',       v:stats.students,  i:'🎓', c:'#059669' },
                { l:'Teachers',       v:stats.teachers,  i:'👨‍🏫', c:'#0891b2' },
                { l:'HODs',           v:stats.hods,      i:'🏛️', c:'#7c3aed' },
                { l:'Admins',         v:stats.admins,    i:'👑', c:'#dc2626' },
                { l:'Pending',        v:stats.pending,   i:'⏳', c:'#f59e0b' },
                { l:'Admin Requests', v:stats.adminReqs, i:'🔑', c:'#ef4444' },
              ] as { l:string; v:number; i:string; c:string }[]).map(s => (
                <div key={s.l} style={{ ...S.statCard, borderTop:`4px solid ${s.c}` }}>
                  <div style={{ fontSize:30 }}>{s.i}</div>
                  <div style={{ fontSize:26, fontWeight:800, color:s.c }}>{s.v}</div>
                  <div style={{ color:'#718096', fontSize:12 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {(pending.length + pendingAdminReqs.length) > 0 && (
              <div style={S.alertBar}>
                ⚠️ <strong>{pending.length}</strong> role approval(s) and <strong>{pendingAdminReqs.length}</strong> admin request(s) pending.
                <button style={S.alertBtn} onClick={() => setTab(pending.length>0 ? 'pending' : 'adminReqs')}>Review →</button>
              </div>
            )}
          </div>
        )}

        {/* ADMIN'S OWN SECTIONS */}
        {tab === 'sections' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ ...S.h2, margin: 0 }}>👨‍🏫 My Sections</h2>
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
              <div style={S.empty}>No sections found. Update filters or create one to get started!</div>
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
                    
                    <div style={{ display: 'flex', gap: 6, margin: '14px 0 10px', flexWrap: 'wrap' }}>
                      <button style={S.smBtn} onClick={() => { setStuModal(sec); setSelStu([]); }}>
                        + Add Students
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
                {sections.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                    <p>No sections available to generate a QR code.</p>
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

        {/* ATTENDANCE TAB FOR ADMIN SECTIONS */}
        {tab === 'attendance' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ ...S.h2, margin: 0 }}>📈 My Classes Attendance</h2>
                <p style={{ color: '#718096', margin: '4px 0 0', fontSize: 14 }}>Attendance overview for sections you are directly teaching.</p>
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

        {/* ALL USERS */}
        {tab === 'users' && (
          <div>
            <div style={S.controls}>
              <input style={S.search} placeholder="🔍 Search name / email / roll…" value={search} onChange={e => setSearch(e.target.value)} />
              <select style={S.sel} value={roleF} onChange={e => setRoleF(e.target.value)}>
                <option value="all">All Roles</option>
                {(['student','teacher','hod','admin'] as UserRole[]).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button style={S.pBtn} onClick={() => setAdd(true)}>+ Add User</button>
            </div>
            <div style={S.tableCard}>
              <table style={S.table}>
                <thead><tr style={S.thead}>
                  {['Name','Email','Roll / Dept','Year/Sem','Role','Status','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u._id} style={S.tr}>
                      <td style={S.td}><strong>{u.name}</strong></td>
                      <td style={S.td}><span style={{ fontSize:12 }}>{u.email}</span></td>
                      <td style={S.td}>{u.rollNumber||'—'}<br /><span style={{ fontSize:11,color:'#718096' }}>{u.department}</span></td>
                      <td style={S.td}>{u.year ? `Y${u.year} S${u.semester}` : '—'}</td>
                      <td style={S.td}>
                        <select value={u.role} onChange={e => changeRole(u._id, e.target.value as UserRole)}
                          style={{ ...S.roleSelect, background:RC[u.role], color:'white' }}>
                          {(['student','teacher','hod','admin'] as UserRole[]).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={S.td}>
                        <span style={{ ...S.chip, background:u.isActive?'#d1fae5':'#fee2e2', color:u.isActive?'#065f46':'#991b1b' }}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={S.td}>
                        <button style={S.iBtn} onClick={() => toggle(u._id)}>{u.isActive ? '🚫' : '✅'}</button>
                        <button style={{ ...S.iBtn, color:'#dc2626' }} onClick={() => del(u._id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PENDING */}
        {tab === 'pending' && (
          <div>
            <h2 style={S.h2}>⏳ Pending Role Approvals</h2>
            {pending.length === 0
              ? <div style={S.empty}>✅ All caught up!</div>
              : pending.map(u => (
                  <div key={u._id} style={S.pendCard}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:15 }}>{u.name}</div>
                      <div style={{ color:'#718096', fontSize:13 }}>{u.email}</div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                        <span style={{ ...S.chip, background:RC[u.roleRequest!]+'20', color:RC[u.roleRequest!] }}>Requesting: {u.roleRequest?.toUpperCase()}</span>
                        {u.department && <span style={S.infoBit}>🏫 {u.department}</span>}
                        {u.rollNumber  && <span style={S.infoBit}>🎓 {u.rollNumber}</span>}
                        {u.year        && <span style={S.infoBit}>📅 Y{u.year} S{u.semester}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button style={S.approveBtn} onClick={() => approve(u._id)}>✅ Approve</button>
                      <button style={S.rejectBtn}  onClick={() => setRM(u)}>✕ Reject</button>
                    </div>
                  </div>
                ))
            }
          </div>
        )}

        {/* ADMIN REQUESTS */}
        {tab === 'adminReqs' && (
          <div>
            <h2 style={S.h2}>🔑 Admin Access Requests</h2>
            {adminReqs.length === 0
              ? <div style={S.empty}>✅ No admin access requests.</div>
              : adminReqs.map(req => (
                  <div key={req._id} style={{ ...S.pendCard, borderLeft:`4px solid ${req.status==='pending'?'#f59e0b':req.status==='approved'?'#059669':'#dc2626'}` }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:4 }}>
                        <div style={{ fontWeight:700 }}>{req.requester?.name}</div>
                        <span style={{ ...S.chip, background:req.status==='pending'?'#fef3c7':req.status==='approved'?'#d1fae5':'#fee2e2', color:req.status==='pending'?'#92400e':req.status==='approved'?'#065f46':'#991b1b' }}>
                          {req.status==='pending'?'⏳ Pending':req.status==='approved'?'✅ Approved':'✕ Rejected'}
                        </span>
                      </div>
                      <div style={{ color:'#718096', fontSize:13 }}>{req.requester?.email}</div>
                      <span style={S.infoBit}>🔑 <strong style={{ fontFamily:'monospace' }}>{req.collegeCode}</strong></span>
                    </div>
                    {req.status === 'pending' && (
                      <div style={{ display:'flex', gap:8 }}>
                        <button style={S.approveBtn} onClick={() => approveAdminReq(req._id)}>✅ Grant</button>
                        <button style={S.rejectBtn}  onClick={() => { setRRM(req); setRRR(''); }}>✕ Deny</button>
                      </div>
                    )}
                  </div>
                ))
            }
          </div>
        )}

        {/* HOD SETUP */}
        {tab === 'hod' && (
          <div>
            <h2 style={S.h2}>🏛️ HOD Assignment</h2>
            <div style={S.formCard}>
              <form onSubmit={assignHOD} style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
                <div style={{ flex:2, minWidth:200 }}>
                  <label style={S.label}>Select User</label>
                  <select style={S.input} value={hodForm.userId} onChange={e => setHF(f => ({ ...f, userId:e.target.value }))} required>
                    <option value="">Choose user…</option>
                    {users.filter(u => u.role === 'hod' || u.role === 'teacher').map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.email}) — {u.role.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex:1, minWidth:160 }}>
                  <label style={S.label}>Department</label>
                  <select style={S.input} value={hodForm.department} onChange={e => setHF(f => ({ ...f, department:e.target.value }))} required>
                    <option value="">Select Dept...</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <button type="submit" style={S.pBtn}>🏛️ Assign HOD</button>
              </form>
            </div>
            <h3 style={{ margin:'24px 0 12px' }}>Current HODs</h3>
            <div style={S.tableCard}>
              <table style={S.table}>
                <thead><tr style={S.thead}>
                  {['Name','Email','Department','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {users.filter(u => u.role==='hod').map(u => (
                    <tr key={u._id} style={S.tr}>
                      <td style={S.td}><strong>{u.name}</strong></td>
                      <td style={S.td}>{u.email}</td>
                      <td style={S.td}><span style={{ ...S.chip, background:'#ede9fe', color:'#7c3aed' }}>{u.hodDepartment||'—'}</span></td>
                      <td style={S.td}>
                        <button style={S.iBtn} onClick={() => changeRole(u._id,'teacher')} title="Demote to Teacher">⬇️</button>
                        <button style={{ ...S.iBtn, color:'#dc2626' }} onClick={() => del(u._id)} title="Delete User">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COLLEGE CODE */}
        {tab === 'code' && (
          <div style={{ maxWidth: 520 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>🔑</span> College Code
            </h2>
            <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
              {codeDoc.exists
                ? <div style={{ background: '#d1fae5', color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, marginBottom: 24, fontSize: 15, fontWeight: 600 }}>
                    <span style={{ fontSize: 16 }}>☑️</span> Current code: <strong style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 2 }}>{codeDoc.code}</strong>
                  </div>
                : <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 14 }}>
                    ⚠️ No college code set. Students cannot register without it.
                  </div>
              }
              <form onSubmit={saveCode} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8 }}>College Name</label>
                  <input style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15, color: '#334155', boxSizing: 'border-box', outline: 'none' }} 
                    placeholder="ABC Institute of Technology" value={codeForm.collegeName} onChange={e => setCF(f => ({ ...f, collegeName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8 }}>College Code *</label>
                  <input style={{ width: '100%', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 20, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 3, color: '#0f172a', boxSizing: 'border-box', outline: 'none' }}
                    placeholder="COLLEGE2024" value={codeForm.code} onChange={e => setCF(f => ({ ...f, code: e.target.value.toUpperCase() }))} required minLength={3} />
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: '8px 0 0' }}>Min 3 chars. Case-insensitive.</p>
                </div>
                <button type="submit" style={{ width: '100%', padding: '12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  {codeDoc.exists ? '🔄 Update Code' : '🔑 Set Code'}
                </button>
              </form>
              {codeDoc.updatedAt && <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 16, marginBottom: 0 }}>Last updated: {new Date(codeDoc.updatedAt).toLocaleString()}</p>}
            </div>
          </div>
        )}
      </div>

      {/* CREATE SECTION MODAL (Admin assigned only) */}
      {showSecModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0 }}>Create Section</h2>
              <button style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }} onClick={() => setSSM(false)}>×</button>
            </div>
            <p style={{ color: '#718096', fontSize: 13, marginBottom: 16 }}>
              Any section you create here is assigned to you. You can generate QR codes for it in the "QR Code" tab.
            </p>
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
                  <select style={S.input} value={newSec.department} onChange={e => setNS(f => ({ ...f, department: e.target.value }))}>
                    <option value="">Select Dept...</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
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
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="submit" style={S.pBtn}>Create & Assign to Me</button>
                <button type="button" style={S.secBtn} onClick={() => setSSM(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STUDENTS MODAL */}
      {stuModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>Add Students</h2>
              <button style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }} onClick={() => { setStuModal(null); setSelStu([]); setStuSearch(''); }}>×</button>
            </div>
            <p style={{ color: '#718096', marginBottom: 12 }}>
              <strong>{stuModal.subject} — {stuModal.name}</strong>
            </p>

            <input
              style={{ ...S.input, marginBottom: 12 }}
              placeholder="🔍 Search name or roll number…"
              value={stuSearch}
              onChange={e => setStuSearch(e.target.value)}
            />

            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              {availableStudents
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
              {availableStudents.filter(st => !stuModal.students?.find((s: any) => s._id === st._id || s === st._id)).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No available students found</div>
              )}
            </div>

            <p style={{ fontSize: 13, color: '#718096', margin: '8px 0' }}>{selStu.length} selected</p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...S.pBtn, opacity: selStu.length === 0 ? 0.5 : 1 }} onClick={addStudents} disabled={selStu.length === 0}>
                + Add {selStu.length} Student(s)
              </button>
              <button style={S.secBtn} onClick={() => { setStuModal(null); setSelStu([]); setStuSearch(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {addModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={{ margin:'0 0 18px' }}>Create User</h2>
            <form onSubmit={createUser} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(['name','email','password'] as const).map(k => (
                <input key={k} style={S.input} type={k==='password'?'password':k==='email'?'email':'text'}
                  placeholder={k.charAt(0).toUpperCase()+k.slice(1)}
                  value={newUser[k]} onChange={e => setNU(u => ({ ...u, [k]:e.target.value }))} required />
              ))}
              <select style={S.input} value={newUser.role} onChange={e => setNU(u => ({ ...u, role:e.target.value as UserRole }))}>
                {(['student','teacher','hod','admin'] as UserRole[]).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <input style={S.input} placeholder="Roll Number" value={newUser.rollNumber} onChange={e => setNU(u => ({ ...u, rollNumber:e.target.value }))} />
                <select style={S.input} value={newUser.department} onChange={e => setNU(u => ({ ...u, department:e.target.value }))}>
                  <option value="">Select Dept...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input style={S.input} type="number" placeholder="Year"     value={newUser.year}     onChange={e => setNU(u => ({ ...u, year:e.target.value }))} />
                <input style={S.input} type="number" placeholder="Semester" value={newUser.semester} onChange={e => setNU(u => ({ ...u, semester:e.target.value }))} />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" style={S.pBtn}>Create</button>
                <button type="button" style={S.secBtn} onClick={() => setAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT ROLE MODAL */}
      {rejectModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={{ color:'#dc2626', margin:'0 0 10px' }}>✕ Reject Request</h2>
            <p style={{ color:'#718096', marginBottom:14 }}>Rejecting <strong>{rejectModal.name}</strong>'s <strong>{rejectModal.roleRequest}</strong> request.</p>
            <label style={S.label}>Reason (optional)</label>
            <textarea style={{ ...S.input, height:80, resize:'vertical' }} value={rejectReason} onChange={e => setRR(e.target.value)} />
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button style={S.rejectBtn} onClick={reject}>Confirm Reject</button>
              <button style={S.secBtn} onClick={() => { setRM(null); setRR(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT ADMIN REQUEST MODAL */}
      {rejectReqModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={{ color:'#dc2626', margin:'0 0 10px' }}>✕ Deny Admin Access</h2>
            <p style={{ color:'#718096', marginBottom:14 }}>Denying <strong>{rejectReqModal.requester?.name}</strong>.</p>
            <label style={S.label}>Reason (optional)</label>
            <textarea style={{ ...S.input, height:80, resize:'vertical' }} value={rejectReqReason} onChange={e => setRRR(e.target.value)} />
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button style={S.rejectBtn} onClick={rejectAdminReq}>Confirm Deny</button>
              <button style={S.secBtn} onClick={() => setRRM(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:       { minHeight:'100vh', background:'#f1f5f9', fontFamily:'system-ui,sans-serif' },
  nav:        { background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'white', padding:'14px 28px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 },
  brand:      { fontSize:20, fontWeight:800 },
  pill:       { background:'rgba(255,255,255,0.2)', borderRadius:4, padding:'2px 8px', fontSize:11, marginLeft:8 },
  logoutBtn:  { background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.3)', borderRadius:6, padding:'6px 14px', cursor:'pointer' },
  badge:      { background:'#f59e0b', color:'white', borderRadius:12, padding:'4px 10px', fontSize:12, fontWeight:700 },
  tabBar:     { background:'white', borderBottom:'1px solid #e2e8f0', padding:'0 20px', display:'flex', gap:4, overflowX:'auto' },
  tabOn:      { padding:'14px 16px', background:'none', border:'none', borderBottom:'3px solid #7c3aed', color:'#7c3aed', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', fontSize:13 },
  tabOff:     { padding:'14px 16px', background:'none', border:'none', borderBottom:'3px solid transparent', color:'#718096', cursor:'pointer', whiteSpace:'nowrap', fontSize:13 },
  tbadge:     { background:'#f59e0b', color:'white', borderRadius:10, padding:'1px 7px', fontSize:11, marginLeft:4 },
  container:  { maxWidth:1200, margin:'0 auto', padding:'28px 20px' },
  h2:         { margin:'0 0 20px', fontSize:20, color:'#1a202c' },
  statsGrid:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:14, marginBottom:24 },
  statCard:   { background:'white', borderRadius:12, padding:18, textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  card:       { background: 'white', borderRadius: 14, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  alertBar:   { background:'#fffbeb', border:'1px solid #fde047', borderRadius:10, padding:'12px 18px', display:'flex', alignItems:'center', gap:12, fontSize:14, color:'#713f12', flexWrap:'wrap' },
  alertBtn:   { marginLeft:'auto', background:'#f59e0b', color:'white', border:'none', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 },
  controls:   { display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' },
  search:     { flex:1, minWidth:200, padding:'10px 14px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:14 },
  sel:        { padding:'10px 14px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:14 },
  pBtn:       { padding:'10px 18px', background:'#7c3aed', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 },
  secBtn:     { padding:'10px 18px', background:'#e5e7eb', color:'#374151', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 },
  smBtn:      { padding: '5px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  fInput:     { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' },
  tableCard:  { background:'white', borderRadius:12, overflow:'auto', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  table:      { width:'100%', borderCollapse:'collapse', minWidth:600 },
  thead:      { background:'#f8fafc' },
  th:         { padding:'11px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', borderBottom:'1px solid #e5e7eb', textTransform:'uppercase', letterSpacing:0.5 },
  tr:         { borderBottom:'1px solid #f3f4f6' },
  td:         { padding:'11px 14px', fontSize:14, color:'#1a202c' },
  chip:       { display:'inline-block', padding:'3px 10px', borderRadius:12, fontSize:12, fontWeight:500 },
  roleSelect: { border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12, fontWeight:600 },
  iBtn:       { background:'none', border:'none', cursor:'pointer', fontSize:17, marginRight:2 },
  pendCard:   { background:'white', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:10 },
  infoBit:    { background:'#f3f4f6', color:'#4b5563', borderRadius:6, padding:'2px 8px', fontSize:12 },
  approveBtn: { padding:'8px 16px', background:'#059669', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:13, whiteSpace:'nowrap' },
  rejectBtn:  { padding:'8px 16px', background:'#dc2626', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:13, whiteSpace:'nowrap' },
  empty:      { textAlign:'center', padding:'48px 20px', color:'#059669', fontSize:16, background:'#f0fdf4', borderRadius:12 },
  formCard:   { background:'white', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', marginBottom:24 },
  label:      { display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:4 },
  input:      { width:'100%', padding:'10px 13px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:14, boxSizing:'border-box', fontFamily:'inherit' },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 },
  modal:      { background:'white', borderRadius:16, padding:28, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' },
};