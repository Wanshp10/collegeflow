import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import toast from 'react-hot-toast';
import {
  loginThunk, registerThunk, requestAdminThunk,
  clearError, clearExistsData, clearPending, clearGenerated,
  selectUser, selectAuthLoading, selectRequestLoading,
  selectAuthError, selectPendingMsg, selectGeneratedCode, selectExistsData,
} from '../store/slices/authSlice';
import type { UserRole } from '../types';
import API from '../api/axios';

// ── NEW: Master list of departments ──
const DEPARTMENTS = [
  'Computer Science', 'AI & DS', 'IT', 'Chemical', 
  'Mechanical', 'Civil', 'Electrical', 'Electronics'
];

type Mode = 'login' | 'register' | 'pending';
interface RoleInfo { icon: string; label: string; color: string; note: string }
const ROLES: Record<UserRole, RoleInfo> = {
  student: { icon: '🎓', label: 'Student',  color: '#059669', note: 'Instant access' },
  teacher: { icon: '👨‍🏫', label: 'Teacher', color: '#0891b2', note: 'Needs approval' },
  hod:     { icon: '🏛️', label: 'HOD',      color: '#7c3aed', note: 'Needs approval' },
  admin:   { icon: '👑', label: 'Admin',    color: '#dc2626', note: 'Own college code' },
};

interface Form {
  name: string; email: string; password: string; phone: string;
  collegeCode: string; rollNumber: string; department: string; year: string; semester: string;
}

export default function Login() {
  const dispatch       = useAppDispatch();
  const navigate       = useNavigate();
  const user           = useAppSelector(selectUser);
  const loading        = useAppSelector(selectAuthLoading);
  const requestLoading = useAppSelector(selectRequestLoading);
  const authError      = useAppSelector(selectAuthError);
  const pendingMsg     = useAppSelector(selectPendingMsg);
  const generatedCode  = useAppSelector(selectGeneratedCode);
  const existsData     = useAppSelector(selectExistsData);

  const [mode, setMode]        = useState<Mode>('login');
  const [role, setRole]        = useState<UserRole>('student');
  const [ciExists, setCiExists] = useState(false);
  const [form, setForm]        = useState<Form>({
    name:'',email:'',password:'',phone:'',collegeCode:'',rollNumber:'',department:'',year:'',semester:'',
  });

  useEffect(() => { if (user) navigate(`/${user.role}`, { replace: true }); }, [user, navigate]);

  useEffect(() => {
    API.get<{ exists: boolean; collegeName: string }>('/auth/college-code/exists')
      .then(r => setCiExists(r.data.exists)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!authError) return;
    if (authError.approvalStatus === 'pending') { setMode('pending'); }
    else { toast.error(authError.message); dispatch(clearError()); }
  }, [authError, dispatch]);

  useEffect(() => {
    if (generatedCode) {
      toast.success(`College code: ${generatedCode} — share with your users`, { duration: 9000 });
      dispatch(clearGenerated());
    }
  }, [generatedCode, dispatch]);

  useEffect(() => { if (pendingMsg) setMode('pending'); }, [pendingMsg]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await dispatch(loginThunk({ email: form.email, password: form.password }));
    if (loginThunk.fulfilled.match(r)) { toast.success(`Welcome, ${r.payload.user.name}!`); navigate(`/${r.payload.user.role}`); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'admin' && !ciExists) { toast.error('College not configured. Contact admin.'); return; }
    if (role === 'student') {
      if (!form.rollNumber)  { toast.error('Roll number required'); return; }
      if (!form.department)  { toast.error('Department required'); return; }
      if (!form.year)        { toast.error('Year required'); return; }
      if (!form.semester)    { toast.error('Semester required'); return; }
    }
    const r = await dispatch(registerThunk({
      name: form.name, email: form.email, password: form.password,
      phone: form.phone || undefined, roleRequest: role,
      collegeCode: form.collegeCode || undefined,
      rollNumber:  form.rollNumber  || undefined,
      department:  form.department  || undefined,
      year:     form.year     ? Number(form.year)     : undefined,
      semester: form.semester ? Number(form.semester) : undefined,
    }));
    if (registerThunk.fulfilled.match(r)) {
      const p = r.payload;
      if (p.pending || p.exists) return;
      if (!p.generatedCode) toast.success(`Welcome, ${p.user?.name}!`);
      if (p.user) navigate(`/${p.user.role}`);
    }
  };

  const handleRequestAccess = async () => {
    if (!existsData) return;
    const r = await dispatch(requestAdminThunk({
      name: form.name, email: form.email, password: form.password, phone: form.phone || undefined,
      collegeCode: existsData.collegeCode, targetAdminId: existsData.admin._id,
    }));
    if (requestAdminThunk.rejected.match(r)) toast.error(r.payload?.message ?? 'Failed');
  };

  const ri = ROLES[role];

  if (mode === 'pending') return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}>⏳</div>
        <h2 style={{ margin: '16px 0 10px' }}>Awaiting Approval</h2>
        <p style={{ color: '#718096', lineHeight: 1.7, marginBottom: 20 }}>{pendingMsg}</p>
        <div style={S.infoBox}>Try logging in after the admin approves your request.</div>
        <button style={{ ...S.btn, marginTop: 16 }} onClick={() => { setMode('login'); dispatch(clearPending()); }}>
          ← Back to Login
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 52 }}>📋</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '6px 0 2px', color: '#1a202c' }}>AttendEase</h1>
          <p style={{ color: '#718096', fontSize: 13 }}>Attendance Management System</p>
        </div>

        <div style={S.tabs}>
          {(['login','register'] as Mode[]).map(m => (
            <button key={m} style={mode === m ? S.tabOn : S.tabOff} onClick={() => setMode(m)}>
              {m === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} style={S.form}>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} required />
            <label style={S.label}>Password</label>
            <input style={S.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            <button style={S.btn} disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
            <p style={S.hint}>No account? <span style={S.link} onClick={() => setMode('register')}>Register</span></p>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} style={S.form}>
            <label style={S.label}>Register as</label>
            <div style={S.roleGrid}>
              {(Object.keys(ROLES) as UserRole[]).map(r => (
                <button key={r} type="button"
                  style={{ ...S.roleBtn, ...(role===r ? { borderColor:ROLES[r].color, background:ROLES[r].color+'12', color:ROLES[r].color } : {}) }}
                  onClick={() => { setRole(r); dispatch(clearExistsData()); }}>
                  <span style={{ fontSize: 22 }}>{ROLES[r].icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{ROLES[r].label}</span>
                  <span style={{ fontSize: 10, color: role===r ? ROLES[r].color : '#9ca3af' }}>{ROLES[r].note}</span>
                </button>
              ))}
            </div>
            <div style={{ ...S.infoBox, borderColor: ri.color+'40', background: ri.color+'08', color: ri.color }}>
              {ri.icon} {ri.label} — {ri.note}
            </div>

            <div style={S.grid2}>
              <div><label style={S.label}>Full Name *</label><input style={S.input} placeholder="John Smith" value={form.name} onChange={set('name')} required /></div>
              <div><label style={S.label}>Phone</label><input style={S.input} placeholder="+91 9999999999" value={form.phone} onChange={set('phone')} /></div>
            </div>
            <label style={S.label}>Email *</label>
            <input style={S.input} type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} required />
            <label style={S.label}>Password *</label>
            <input style={S.input} type="password" placeholder="Min 6 chars" value={form.password} onChange={set('password')} required minLength={6} />

            {role === 'student' && (
              <div style={S.studentBox}>
                <div style={{ fontWeight: 700, color: '#059669', fontSize: 13, marginBottom: 8 }}>📚 Student Details</div>
                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Roll Number *</label>
                    <input style={S.input} placeholder="CS21001" value={form.rollNumber} onChange={set('rollNumber')} required />
                  </div>
                  {/* ── UPDATED: DROPDOWN FOR DEPARTMENT ── */}
                  <div>
                    <label style={S.label}>Department *</label>
                    <select style={S.input} value={form.department} onChange={set('department')} required>
                      <option value="">Select Dept...</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Year *</label>
                    <select style={S.input} value={form.year} onChange={set('year')} required>
                      <option value="">Select Year</option>
                      {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Semester *</label>
                    <select style={S.input} value={form.semester} onChange={set('semester')} required>
                      <option value="">Select Semester</option>
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div style={{ ...S.codeBox, ...(role==='admin' ? { background:'#fef3c7', borderColor:'#f59e0b' } : {}) }}>
              {role === 'admin' ? (
                <>
                  <label style={S.label}>College Code <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
                  <input style={{ ...S.input, fontWeight: 700, letterSpacing: 2, fontFamily: 'monospace' }}
                    placeholder="Leave blank to auto-generate" value={form.collegeCode}
                    onChange={e => { set('collegeCode')(e); dispatch(clearExistsData()); }} />
                  <p style={{ fontSize: 12, color: '#92400e', margin: '6px 0 0' }}>
                    💡 Leave blank → a unique 4-digit code is auto-generated.
                  </p>
                </>
              ) : (
                <>
                  <label style={S.label}>College Code *</label>
                  <input style={{ ...S.input, fontWeight: 700, letterSpacing: 2, fontFamily: 'monospace' }}
                    placeholder="Enter your college code" value={form.collegeCode} onChange={set('collegeCode')} required />
                  {!ciExists && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>⚠️ Not configured — contact admin</p>}
                </>
              )}
            </div>

            <button style={{ ...S.btn, background: `linear-gradient(135deg,${ri.color},${ri.color}cc)` }} disabled={loading}>
              {loading ? 'Submitting…'
                : role==='student' ? '🎓 Create Account'
                : role==='admin'   ? '👑 Create Admin Account'
                : `📋 Submit ${role.toUpperCase()} Request`}
            </button>
            <p style={S.hint}>Have an account? <span style={S.link} onClick={() => setMode('login')}>Login</span></p>
          </form>
        )}
      </div>

      {/* Code collision modal */}
      {existsData && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <h2 style={{ margin:'0 0 4px', fontSize:20 }}>⚠️ Code Already In Use</h2>
                <p style={{ margin:0, color:'#718096', fontSize:14 }}>This code belongs to another admin.</p>
              </div>
              <button style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#9ca3af' }} onClick={() => dispatch(clearExistsData())}>×</button>
            </div>
            <div style={{ background:'#f3f4f6', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ fontSize:26, fontFamily:'monospace', fontWeight:800, color:'#dc2626', background:'#fee2e2', borderRadius:8, padding:'6px 14px', letterSpacing:3 }}>
                  {existsData.collegeCode}
                </span>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{existsData.admin?.name}</div>
                  <div style={{ color:'#718096', fontSize:13 }}>{existsData.admin?.email}</div>
                </div>
              </div>
            </div>
            <div style={{ border:'2px solid #e0f2fe', borderRadius:12, padding:16, marginBottom:12, background:'#f0f9ff' }}>
              <div style={{ fontWeight:700, color:'#0369a1', marginBottom:8 }}>📩 Request Admin Access</div>
              <button style={{ ...S.btn, background:'linear-gradient(135deg,#0891b2,#0e7490)', padding:'10px 20px' }}
                onClick={handleRequestAccess} disabled={requestLoading}>
                {requestLoading ? 'Sending…' : '📩 Send Admin Access Request'}
              </button>
            </div>
            <div style={{ border:'2px solid #e5e7eb', borderRadius:12, padding:16, background:'#fafafa' }}>
              <div style={{ fontWeight:700, color:'#374151', marginBottom:8 }}>✏️ Use a Different Code</div>
              <button style={{ ...S.btn, background:'linear-gradient(135deg,#6b7280,#4b5563)', padding:'10px 20px' }}
                onClick={() => { dispatch(clearExistsData()); setForm(f => ({ ...f, collegeCode:'' })); }}>
                ✏️ Enter Different Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:      { minHeight:'100vh', background:'linear-gradient(135deg,#1e3a5f,#2d6a4f)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 },
  card:      { background:'white', borderRadius:20, padding:'36px 32px', width:'100%', maxWidth:480, boxShadow:'0 24px 64px rgba(0,0,0,0.2)' },
  tabs:      { display:'flex', background:'#f7fafc', borderRadius:10, padding:4, marginBottom:22 },
  tabOn:     { flex:1, padding:'9px', background:'white', border:'none', borderRadius:7, fontWeight:700, cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.1)', color:'#1e3a5f', fontSize:14 },
  tabOff:    { flex:1, padding:'9px', background:'none', border:'none', borderRadius:7, cursor:'pointer', color:'#718096', fontSize:14 },
  form:      { display:'flex', flexDirection:'column', gap:11 },
  label:     { fontSize:13, fontWeight:600, color:'#374151', marginBottom:2 },
  input:     { width:'100%', padding:'10px 13px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:14, boxSizing:'border-box', fontFamily:'inherit', outline:'none' },
  btn:       { marginTop:4, padding:'13px', background:'linear-gradient(135deg,#1e3a5f,#2d6a4f)', color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer', width:'100%' },
  hint:      { textAlign:'center', color:'#a0aec0', fontSize:13 },
  link:      { color:'#1e3a5f', cursor:'pointer', fontWeight:700 },
  infoBox:   { border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 13px', fontSize:13 },
  roleGrid:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  roleBtn:   { display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'10px 8px', border:'2px solid #e2e8f0', borderRadius:10, cursor:'pointer', background:'white', color:'#4a5568' },
  grid2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  studentBox:{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:14, display:'flex', flexDirection:'column', gap:10 },
  codeBox:   { background:'#fef9c3', border:'1px solid #fde047', borderRadius:10, padding:14 },
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20 },
  modal:     { background:'white', borderRadius:18, padding:28, width:'100%', maxWidth:480, boxShadow:'0 24px 64px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto' },
};