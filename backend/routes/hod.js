const express     = require('express');
const router      = express.Router();
const { minRole } = require('../middleware/auth');
const User        = require('../models/User');
const Section     = require('../models/Section');
const Attendance  = require('../models/Attendance');

router.use(minRole('hod'));

// Helper to get HOD's department
async function getHodDept(req) {
  if (!req.user) return null;
  if (req.user.role === 'admin') return req.query.department || null;
  const hod = await User.findById(req.user.id).select('hodDepartment');
  return hod?.hodDepartment || null;
}

// ── STATS ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const dept   = await getHodDept(req);
    const filter = { collegeCode: req.user.collegeCode };
    if (dept) filter.department = dept;
    
    // Find all admins to exclude their sections
    const admins = await User.find({ role: 'admin', collegeCode: req.user.collegeCode }).distinct('_id');
    const secFilter = dept ? { department: dept } : {};
    secFilter.teacher = { $nin: admins }; // 🔒 Hides Admin sections from the count

    const [teachers, students, sections] = await Promise.all([
      User.countDocuments({ role: 'teacher', ...filter }),
      User.countDocuments({ role: 'student', ...filter }),
      Section.countDocuments(secFilter),
    ]);
    res.json({ teachers, students, sections });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── TEACHERS ──────────────────────────────────────────────────────────────────
router.get('/teachers', async (req, res) => {
  try {
    const { filterDept } = req.query;
    const hodDept = await getHodDept(req);

    const baseFilter = { role: 'teacher', isActive: true, collegeCode: req.user.collegeCode };

    let filter;
    if (filterDept === 'unassigned') {
      filter = {
        ...baseFilter,
        $or: [ { department: { $exists: false } }, { department: null }, { department: '' } ],
      };
    } else if (filterDept) {
      filter = { ...baseFilter, department: filterDept };
    } else if (hodDept) {
      filter = {
        ...baseFilter,
        $or: [
          { department: hodDept },
          { department: { $exists: false } },
          { department: null },
          { department: '' },
        ],
      };
    } else {
      filter = baseFilter;
    }

    const teachers = await User.find(filter).select('-password');
    res.json(teachers);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── ASSIGN DEPARTMENT TO TEACHER ──────────────────────────────────────────────
router.put('/teachers/:id/assign-dept', async (req, res) => {
  try {
    const hod = await User.findById(req.user.id).select('hodDepartment');
    const hodDept = hod?.hodDepartment;

    if (!hodDept) return res.status(403).json({ message: 'You do not have a department assigned to manage.' });

    const teacher = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'teacher', collegeCode: req.user.collegeCode },
      { department: hodDept },
      { new: true }
    ).select('-password');

    if (!teacher) return res.status(404).json({ message: 'Teacher not found in your college' });
    
    res.json(teacher);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── SMART STUDENT FILTER ──────────────────────────────────────────────────────
router.get('/students', async (req, res) => {
  try {
    const { dept, year, sem, roll, search } = req.query;
    const filter = { role: 'student', isActive: true, collegeCode: req.user.collegeCode };

    if (req.user.role === 'hod') {
      const hod = await User.findById(req.user.id).select('hodDepartment');
      if (hod?.hodDepartment) filter.department = hod.hodDepartment;
    } else if (dept) {
      filter.department = { $regex: dept, $options: 'i' };
    }

    if (year)   filter.year     = Number(year);
    if (sem)    filter.semester = Number(sem);
    if (roll)   filter.rollNumber = { $regex: roll,   $options: 'i' };
    if (search) filter.$or = [
      { name:       { $regex: search, $options: 'i' } },
      { rollNumber: { $regex: search, $options: 'i' } },
      { email:      { $regex: search, $options: 'i' } },
    ];

    const students = await User.find(filter)
      .select('name email rollNumber department year semester')
      .sort({ rollNumber: 1 });
    res.json(students);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── SECTIONS ──────────────────────────────────────────────────────────────────
router.get('/sections', async (req, res) => {
  try {
    const dept   = await getHodDept(req);
    const admins = await User.find({ role: 'admin', collegeCode: req.user.collegeCode }).distinct('_id');
    
    const filter = dept ? { department: dept } : {};
    filter.teacher = { $nin: admins }; // 🔒 Hides Admin sections from the list

    const sections = await Section.find(filter)
      .populate('teacher', 'name email department')
      .populate('hod',     'name email')
      .populate('students','name email rollNumber department year semester');
    res.json(sections);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/sections', async (req, res) => {
  try {
    const { name, subject, subjectCode, year, semester, assignToSelf } = req.body;
    let department = req.body.department;

    if (req.user.role === 'hod') {
      const hod  = await User.findById(req.user.id).select('hodDepartment');
      if (hod?.hodDepartment) department = hod.hodDepartment;
    }

    const section = await Section.create({
      name, subject, subjectCode, department,
      year:     year     ? Number(year)     : undefined,
      semester: semester ? Number(semester) : undefined,
      hod:      req.user.role === 'hod' ? req.user.id : undefined,
      teacher:  assignToSelf ? req.user.id : undefined,
    });
    
    res.status(201).json(await Section.findById(section._id)
      .populate('teacher', 'name email')
      .populate('students','name email rollNumber'));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/sections/:id', async (req, res) => {
  try {
    const dept = await getHodDept(req);
    const filter = { _id: req.params.id };
    if (dept) filter.department = dept; 

    const section = await Section.findOneAndDelete(filter);
    if (!section) return res.status(404).json({ message: 'Section not found or unauthorized' });
    
    res.json({ message: 'Section deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/sections/:id/teacher', async (req, res) => {
  try {
    const dept = await getHodDept(req);
    const teacher = await User.findOne({ _id: req.body.teacherId, role: 'teacher' });
    if (!teacher) return res.status(400).json({ message: 'Teacher not found' });
    
    const filter = { _id: req.params.id };
    if (dept) filter.department = dept;

    const section = await Section.findOneAndUpdate(
      filter, 
      { teacher: req.body.teacherId }, 
      { new: true }
    ).populate('teacher', 'name email department');
    res.json(section);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/sections/:id/students', async (req, res) => {
  try {
    const dept = await getHodDept(req);
    const filter = { _id: req.params.id };
    if (dept) filter.department = dept;

    const ids = [].concat(req.body.studentIds);
    const section = await Section.findOneAndUpdate(
      filter,
      { $addToSet: { students: { $each: ids } } },
      { new: true }
    ).populate('students', 'name email rollNumber department year semester');
    res.json(section);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/sections/:id/students/:studentId', async (req, res) => {
  try {
    const dept = await getHodDept(req);
    const filter = { _id: req.params.id };
    if (dept) filter.department = dept;

    const section = await Section.findOneAndUpdate(
      filter,
      { $pull: { students: req.params.studentId } },
      { new: true }
    ).populate('students', 'name email rollNumber department year semester');
    res.json({ message: 'Student removed', section });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── ATTENDANCE OVERVIEW ───────────────────────────────────────────────────────
router.get('/attendance-overview', async (req, res) => {
  try {
    const dept   = await getHodDept(req);
    
    // 🔓 CHANGED: We removed the "exclude admins" restriction here!
    // Now, if an Admin creates a section and tags it with the HOD's department,
    // the HOD will successfully see it in their Attendance tab.
    const filter = dept ? { department: dept } : {};

    const sections = await Section.find(filter)
      .populate('teacher', 'name email')
      .populate('students','name rollNumber');

    const overview = await Promise.all(sections.map(async (sec) => {
      const studentReports = await Promise.all((sec.students || []).map(async (st) => {
        const present = await Attendance.countDocuments({ student: st._id, section: sec._id, status: 'present' });
        const pct     = sec.totalClasses > 0 ? Math.round((present / sec.totalClasses) * 100) : 0;
        return {
          student:    { id: st._id, name: st.name, rollNumber: st.rollNumber },
          present, total: sec.totalClasses, percentage: pct,
          alert: pct < 35 && sec.totalClasses >= 3,
        };
      }));
      return {
        section:    { id: sec._id, name: sec.name, subject: sec.subject },
        teacher:    sec.teacher,
        studentReports,
        alertCount: studentReports.filter(r => r.alert).length,
      };
    }));

    res.json(overview);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;