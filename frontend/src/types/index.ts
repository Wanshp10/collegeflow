export type UserRole       = 'student' | 'teacher' | 'hod' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type RequestStatus  = 'pending' | 'approved' | 'rejected';

export interface User {
  _id:              string;
  name:             string;
  email:            string;
  phone?:           string;
  role:             UserRole;
  roleRequest?:     UserRole;
  approvalStatus?:  ApprovalStatus;
  approvedBy?:      string;
  rejectionReason?: string;
  rollNumber?:      string;
  year?:            number;
  semester?:        number;
  department?:      string;
  hodDepartment?:   string;
  adminCollegeCode?: string;
  collegeCode?:     string;
  isActive:         boolean;
  createdAt?:       string;
}

export interface Section {
  _id:          string;
  name:         string;
  subject:      string;
  subjectCode?: string;
  department?:  string;
  year?:        number;
  semester?:    number;
  teacher?:     User | null;
  hod?:         User | null;
  students:     User[];
  totalClasses: number;
  isActive:     boolean;
}

export interface ScannedEntry {
  student:   User;
  scannedAt: string;
}

export interface AdminRequest {
  _id:              string;
  requester:        User;
  targetAdmin:      string;
  collegeCode:      string;
  status:           RequestStatus;
  rejectionReason?: string;
  createdAt:        string;
}

export interface CollegeCodeInfo {
  exists:       boolean;
  code:         string;
  collegeName:  string;
  updatedAt?:   string;
}

export interface AdminStats {
  total: number; students: number; teachers: number;
  hods:  number; admins:   number; pending:  number; adminReqs: number;
}

export interface AttendanceRow {
  student: { id: string; name: string; rollNumber?: string; department?: string; year?: number; semester?: number };
  present: number; total: number; percentage: number; alert: boolean;
}

export interface SectionReport {
  section: { id: string; name: string; subject: string; totalClasses: number };
  attendanceData: AttendanceRow[];
  alerts: AttendanceRow[];
}

export interface OverviewItem {
  section: { id: string; name: string; subject: string };
  teacher?: { id: string; name: string } | null;
  studentReports: AttendanceRow[];
  alertCount: number;
}

export interface StudentAttendance {
  section: { id: string; name: string; subject: string; subjectCode?: string };
  present: number; total: number; percentage: number; alert: boolean;
}

// Auth payload types
export interface LoginPayload    { email: string; password: string }
export interface RegisterPayload {
  name: string; email: string; password: string; phone?: string;
  roleRequest: UserRole; collegeCode?: string;
  rollNumber?: string; department?: string; year?: number; semester?: number;
}
export interface RequestAdminPayload {
  name: string; email: string; password: string; phone?: string;
  collegeCode: string; targetAdminId: string;
}

// Redux auth state
export interface ExistsData {
  status:      'exists';
  admin:       Pick<User, '_id' | 'name' | 'email'>;
  collegeCode: string;
}

export interface AuthState {
  user:           User | null;
  token:          string | null;
  loading:        boolean;
  requestLoading: boolean;
  error:          { message: string; approvalStatus?: string } | null;
  pendingMsg:     string | null;
  generatedCode:  string | null;
  existsData:     ExistsData | null;
}