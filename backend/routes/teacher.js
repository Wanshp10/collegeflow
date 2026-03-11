const express  = require('express');
const qrcode   = require('qrcode');
const { v4: uuid } = require('uuid');
const router   = express.Router();
const { auth } = require('../middleware/auth');

const User       = require('../models/User');
const Section    = require('../models/Section');
const QRSession  = require('../models/QRSession');
const Attendance = require('../models/Attendance');

router.use(auth(['teacher','hod','admin']));

router.get('/sections', async (req, res) => {
  res.json(await Section.find({teacher:req.user.id})
    .populate('teacher','name email').populate('hod','name email')
    .populate('students','name email rollNumber year semester department'));
});

router.get('/students', async (req, res) => {
  res.json(await User.find({role:'student',collegeCode:req.user.collegeCode}).select('-password'));
});

router.post('/sections/:id/students', async (req, res) => {
  res.json(await Section.findByIdAndUpdate(req.params.id,
    {$addToSet:{students:req.body.studentId}},{new:true}).populate('students','name email rollNumber'));
});

router.delete('/sections/:id/students/:studentId', async (req, res) => {
  res.json(await Section.findByIdAndUpdate(req.params.id,
    {$pull:{students:req.params.studentId}},{new:true}).populate('students','name email rollNumber'));
});

router.post('/qr/generate', async (req, res) => {
  try {
    const { sectionId,durationMinutes=10,radiusMeters=50,latitude,longitude } = req.body;
    const section = await Section.findById(sectionId);
    if(!section) return res.status(404).json({message:'Section not found'});

    const sessionId = uuid();
    const expiresAt = new Date(Date.now() + durationMinutes*60*1000);
    const session   = await QRSession.create({sessionId,section:sectionId,teacher:req.user.id,expiresAt,latitude,longitude,radiusMeters});
    const qrImage   = await qrcode.toDataURL(JSON.stringify({sessionId,sectionId}),{width:300,margin:2});

    section.totalClasses++; await section.save();
    res.json({sessionId,session,qrImage});
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.get('/qr/sessions/:sessionId/pending', async (req, res) => {
  const s = await QRSession.findOne({sessionId:req.params.sessionId}).populate('scannedBy.student','name rollNumber email');
  if(!s) return res.status(404).json({message:'Not found'});
  res.json({pending:s.scannedBy,sessionId:s.sessionId});
});

router.post('/qr/sessions/:sessionId/finalize', async (req, res) => {
  const { approvedStudentIds=[] } = req.body;
  const session = await QRSession.findOne({sessionId:req.params.sessionId});
  if(!session) return res.status(404).json({message:'Not found'});
  await Attendance.insertMany(approvedStudentIds.map(id=>({
    student:id,section:session.section,session:session._id,status:'present',markedBy:'qr',
  })));
  session.finalized=true; await session.save();
  res.json({message:'Finalized',approved:approvedStudentIds.length});
});

router.get('/sections/:id/attendance', async (req, res) => {
  const sec = await Section.findById(req.params.id).populate('students','name rollNumber email department year semester');
  if(!sec) return res.status(404).json({message:'Not found'});
  const data = await Promise.all((sec.students||[]).map(async st=>{
    const present=await Attendance.countDocuments({student:st._id,section:sec._id,status:'present'});
    const pct=sec.totalClasses>0?Math.round(present/sec.totalClasses*100):0;
    return {student:{id:st._id,name:st.name,rollNumber:st.rollNumber,department:st.department,year:st.year,semester:st.semester},present,total:sec.totalClasses,percentage:pct,alert:pct<35};
  }));
  res.json({section:{id:sec._id,name:sec.name,subject:sec.subject,totalClasses:sec.totalClasses},attendanceData:data,alerts:data.filter(r=>r.alert)});
});

module.exports = router;