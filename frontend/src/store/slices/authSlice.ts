import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axios';
import type { AuthState, User, ExistsData, LoginPayload, RegisterPayload, RequestAdminPayload } from '../../types';
import type { RootState } from '../store';

const load = (): { token: string | null; user: User | null } => {
  try {
    return { token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user') ?? 'null') };
  } catch { return { token: null, user: null }; }
};

type Err = { message: string; approvalStatus?: string };

export const loginThunk = createAsyncThunk<{ token: string; user: User }, LoginPayload, { rejectValue: Err }>(
  'auth/login',
  async (p, { rejectWithValue }) => {
    try {
      const { data } = await API.post<{ token: string; user: User }>('/auth/login', p);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } catch (e: any) { return rejectWithValue(e.response?.data ?? { message: 'Login failed' }); }
  }
);

export const registerThunk = createAsyncThunk<any, RegisterPayload, { rejectValue: Err }>(
  'auth/register',
  async (p, { rejectWithValue }) => {
    try {
      const { data } = await API.post<any>('/auth/register', p);
      if (data.pending) return { pending: true, message: data.message };
      if (data.status === 'exists') return { exists: true, ...data };
      if (data.token) { localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user)); }
      return data;
    } catch (e: any) { return rejectWithValue(e.response?.data ?? { message: 'Registration failed' }); }
  }
);

export const requestAdminThunk = createAsyncThunk<{ message: string }, RequestAdminPayload, { rejectValue: Err }>(
  'auth/requestAdmin',
  async (p, { rejectWithValue }) => {
    try {
      const { data } = await API.post<{ message: string }>('/auth/request-admin', p);
      return data;
    } catch (e: any) { return rejectWithValue(e.response?.data ?? { message: 'Failed' }); }
  }
);

const { token, user } = load();

const init: AuthState = { user, token, loading: false, requestLoading: false, error: null, pendingMsg: null, generatedCode: null, existsData: null };

const s = createSlice({
  name: 'auth',
  initialState: init,
  reducers: {
    logout(state)       { state.user=null; state.token=null; state.error=null; state.pendingMsg=null; state.existsData=null; state.generatedCode=null; localStorage.clear(); },
    clearError(state)      { state.error = null; },
    clearExistsData(state) { state.existsData = null; },
    clearPending(state)    { state.pendingMsg = null; },
    clearGenerated(state)  { state.generatedCode = null; },
  },
  extraReducers: b => {
    b.addCase(loginThunk.pending,   st => { st.loading=true; st.error=null; })
     .addCase(loginThunk.fulfilled, (st,{payload}) => { st.loading=false; st.user=payload.user; st.token=payload.token; })
     .addCase(loginThunk.rejected,  (st,{payload}) => { st.loading=false; st.error=payload??{message:'Error'}; });

    b.addCase(registerThunk.pending,   st => { st.loading=true; st.error=null; st.existsData=null; st.pendingMsg=null; })
     .addCase(registerThunk.fulfilled, (st,{payload}) => {
       st.loading=false;
       if(payload.pending){ st.pendingMsg=payload.message; return; }
       if(payload.exists){ st.existsData=payload as ExistsData; return; }
       if(payload.user){ st.user=payload.user; st.token=payload.token; st.generatedCode=payload.generatedCode??null; }
     })
     .addCase(registerThunk.rejected,  (st,{payload}) => { st.loading=false; st.error=payload??{message:'Error'}; });

    b.addCase(requestAdminThunk.pending,   st => { st.requestLoading=true; st.error=null; })
     .addCase(requestAdminThunk.fulfilled, (st,{payload}) => { st.requestLoading=false; st.existsData=null; st.pendingMsg=payload.message; })
     .addCase(requestAdminThunk.rejected,  (st,{payload}) => { st.requestLoading=false; st.error=payload??{message:'Error'}; });
  },
});

export const { logout, clearError, clearExistsData, clearPending, clearGenerated } = s.actions;

export const selectUser           = (r: RootState) => r.auth.user;
export const selectToken          = (r: RootState) => r.auth.token;
export const selectAuthLoading    = (r: RootState) => r.auth.loading;
export const selectRequestLoading = (r: RootState) => r.auth.requestLoading;
export const selectAuthError      = (r: RootState) => r.auth.error;
export const selectPendingMsg     = (r: RootState) => r.auth.pendingMsg;
export const selectGeneratedCode  = (r: RootState) => r.auth.generatedCode;
export const selectExistsData     = (r: RootState) => r.auth.existsData;

export default s.reducer;