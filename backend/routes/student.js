const express  = require('express');
const router   = express.Router();
const { auth } = require('../middleware/auth');
const Section    = require('../models/Section');
const QRSession  = require('../models/QRSession');
const Attendance = require('../models/Attendance');

router.use(auth(['student']));

router.get('/sections', async (req, res) => {
  res.json(await Section.find({students:req.user.id}).populate('teacher','name email').populate('students','name rollNumber'));
});

router.post('/qr/scan', async (req, res) => {
  try {
    const { sessionId,latitude,longitude } = req.body;
    const s = await QRSession.findOne({sessionId});
    if(!s)                    return res.status(404).json({message:'Invalid QR code'});
    if(new Date()>s.expiresAt)return res.status(400).json({message:'QR code expired'});
    if(s.finalized)           return res.status(400).json({message:'Session already finalized'});
    if(s.scannedBy.find(x=>x.student.toString()===req.user.id))
      return res.status(400).json({message:'Already scanned'});
    if(s.latitude&&s.longitude&&latitude&&longitude){
      const d=getDistance(latitude,longitude,s.latitude,s.longitude);
      if(d>s.radiusMeters) return res.status(400).json({message:`Too far from classroom (${Math.round(d)}m)`});
    }
    s.scannedBy.push({student:req.user.id,scannedAt:new Date()}); await s.save();
    res.json({message:'Scan recorded! Awaiting teacher confirmation.'});
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.get('/attendance', async (req, res) => {
  const sections = await Section.find({students:req.user.id});
  res.json(await Promise.all(sections.map(async sec=>{
    const present=await Attendance.countDocuments({student:req.user.id,section:sec._id,status:'present'});
    const pct=sec.totalClasses>0?Math.round(present/sec.totalClasses*100):0;
    return {section:{id:sec._id,name:sec.name,subject:sec.subject,subjectCode:sec.subjectCode},present,total:sec.totalClasses,percentage:pct,alert:pct<35};
  })));
});

const getDistance=(la1,lo1,la2,lo2)=>{
  const R=6371000,p1=la1*Math.PI/180,p2=la2*Math.PI/180,dp=(la2-la1)*Math.PI/180,dl=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};

module.exports = router;