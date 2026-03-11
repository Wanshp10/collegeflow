const express  = require('express');
const bcrypt   = require('bcryptjs');
const router   = express.Router();
const { auth } = require('../middleware/auth');

const User         = require('../models/User');
const CollegeCode  = require('../models/CollegeCode');
const Section      = require('../models/Section');
const AdminRequest = require('../models/AdminRequest');
const Attendance   = require('../models/Attendance'); // 👈 ADDED ATTENDANCE MODEL

const sf = (req, extra = {}) => ({ collegeCode: req.user.collegeCode, ...extra });
router.use(auth(['admin']));

router.get('/stats', async (req, res) => {
  const f = { collegeCode: req.user.collegeCode };
  const [total,students,teachers,hods,admins,pending,adminReqs] = await Promise.all([
    User.countDocuments(f), User.countDocuments({...f,role:'student'}),
    User.countDocuments({...f,role:'teacher'}), User.countDocuments({...f,role:'hod'}),
    User.countDocuments({...f,role:'admin'}), User.countDocuments({...f,approvalStatus:'pending'}),
    AdminRequest.countDocuments({ targetAdmin: req.user.id, status: 'pending' }),
  ]);
  res.json({ total,students,teachers,hods,admins,pending,adminReqs });
});

router.get('/users', async (req, res) => {
  res.json(await User.find(sf(req)).select('-password').sort({ createdAt: -1 }));
});

router.post('/users', async (req, res) => {
  try {
    const { name,email,password,role,rollNumber,department,year,semester } = req.body;
    const u = await User.create({
      name,email,password:await bcrypt.hash(password,12),role,
      roleRequest:role,approvalStatus:'approved',isActive:true,
      collegeCode:req.user.collegeCode,rollNumber,department,
      year:year?Number(year):undefined,semester:semester?Number(semester):undefined,
    });
    res.json(u);
  } catch(e){ res.status(400).json({message:e.message}); }
});

router.put('/users/:id/role', async (req, res) => {
  const u = await User.findOneAndUpdate({_id:req.params.id,...sf(req)},{role:req.body.role},{new:true}).select('-password');
  if(!u) return res.status(404).json({message:'Not found'});
  res.json(u);
});

router.put('/users/:id/toggle', async (req, res) => {
  const u = await User.findOne({_id:req.params.id,...sf(req)});
  if(!u) return res.status(404).json({message:'Not found'});
  u.isActive=!u.isActive; await u.save(); res.json({isActive:u.isActive});
});

router.delete('/users/:id', async (req, res) => {
  await User.findOneAndDelete({_id:req.params.id,...sf(req)}); res.json({message:'Deleted'});
});

router.get('/pending-users', async (req, res) => {
  res.json(await User.find({...sf(req),approvalStatus:'pending',roleRequest:{$in:['teacher','hod']}}).select('-password').sort({createdAt:1}));
});

router.put('/approve/:id', async (req, res) => {
  const u = await User.findOne({_id:req.params.id,...sf(req)});
  if(!u) return res.status(404).json({message:'Not found'});
  u.approvalStatus='approved'; u.role=u.roleRequest; u.isActive=true; u.approvedBy=req.user.id;
  await u.save(); res.json(u);
});

router.put('/reject/:id', async (req, res) => {
  const u = await User.findOne({_id:req.params.id,...sf(req)});
  if(!u) return res.status(404).json({message:'Not found'});
  u.approvalStatus='rejected'; u.rejectionReason=req.body.reason||'';
  await u.save(); res.json(u);
});

router.get('/college-code', async (req, res) => {
  const d = await CollegeCode.findById('singleton');
  res.json({ exists:!!d, code:d?.code||'', collegeName:d?.collegeName||'', updatedAt:d?.updatedAt });
});

router.put('/college-code', async (req, res) => {
  const { code, collegeName } = req.body;
  if(!code) return res.status(400).json({message:'Code required'});
  const d = await CollegeCode.findOneAndUpdate(
    {_id:'singleton'},{code:code.toUpperCase(),collegeName,updatedBy:req.user.id},{upsert:true,new:true});
  res.json(d);
});

router.get('/hods', async (req, res) => {
  res.json(await User.find(sf(req,{role:'hod'})).select('-password'));
});

router.put('/users/:id/assign-hod', async (req, res) => {
  const u = await User.findOne({_id:req.params.id,...sf(req)});
  if(!u) return res.status(404).json({message:'Not found'});
  u.role='hod'; u.hodDepartment=req.body.department; u.isActive=true;
  await u.save(); res.json(u);
});

/* ── ADMIN SECTIONS (RESTRICTED ONLY TO ADMIN AS TEACHER) ── */
router.get('/sections', async (req, res) => {
  res.json(await Section.find({ teacher: req.user.id })
    .populate('teacher','name email')
    .populate('students','name email rollNumber department year semester'));
});

router.post('/sections', async (req, res) => {
  try {
    const { name, subject, subjectCode, department, year, semester } = req.body;
    const sec = await Section.create({
      name, subject, subjectCode, department,
      year: year ? Number(year) : undefined,
      semester: semester ? Number(semester) : undefined,
      teacher: req.user.id // Locked to the admin creating it
    });
    res.json(await Section.findById(sec._id).populate('teacher','name email'));
  } catch(e) { res.status(400).json({message: e.message}); }
});

router.delete('/sections/:id', async (req, res) => {
  await Section.findOneAndDelete({ _id: req.params.id, teacher: req.user.id });
  res.json({message: 'Deleted'});
});

/* ── ADMIN CAN ASSIGN STUDENTS TO THEIR OWN SECTIONS ── */
router.post('/sections/:id/students', async (req, res) => {
  try {
    const ids = [].concat(req.body.studentIds);
    const section = await Section.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user.id },
      { $addToSet: { students: { $each: ids } } },
      { new: true }
    ).populate('students', 'name email rollNumber department year semester');
    res.json(section);
  } catch(e) { res.status(400).json({message: e.message}); }
});

router.delete('/sections/:id/students/:studentId', async (req, res) => {
  try {
    const section = await Section.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user.id },
      { $pull: { students: req.params.studentId } },
      { new: true }
    ).populate('students', 'name email rollNumber department year semester');
    res.json(section);
  } catch(e) { res.status(400).json({message: e.message}); }
});

router.get('/admin-requests', async (req, res) => {
  res.json(await AdminRequest.find({targetAdmin:req.user.id}).populate('requester','name email').sort({createdAt:-1}));
});

router.put('/admin-requests/:id/approve', async (req, res) => {
  const r = await AdminRequest.findById(req.params.id);
  if(!r) return res.status(404).json({message:'Not found'});
  await User.findByIdAndUpdate(r.requester,{
    role:'admin',roleRequest:'admin',approvalStatus:'approved',isActive:true,
    collegeCode:r.collegeCode,adminCollegeCode:r.collegeCode,
  });
  r.status='approved'; await r.save(); res.json({message:'Granted'});
});

router.put('/admin-requests/:id/reject', async (req, res) => {
  res.json(await AdminRequest.findByIdAndUpdate(req.params.id,
    {status:'rejected',rejectionReason:req.body.reason||''},{new:true}));
});

/* ── NEW: ADMIN ATTENDANCE OVERVIEW FOR THEIR SECTIONS ── */
router.get('/attendance-overview', async (req, res) => {
  try {
    // Fetches attendance only for sections the admin is personally teaching
    const sections = await Section.find({ teacher: req.user.id })
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