const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const router   = express.Router();

const User         = require('../models/User');
const College      = require('../models/College');
const AdminRequest = require('../models/AdminRequest');

const sign = (u) => jwt.sign(
  { id: u._id, role: u.role, name: u.name, email: u.email, collegeCode: u.collegeCode, adminCollegeCode: u.adminCollegeCode },
  process.env.JWT_SECRET, { expiresIn: '7d' }
);

// Check if ANY admin exists in the system yet
router.get('/college-code/exists', async (req, res) => {
  const count = await User.countDocuments({ role: 'admin' });
  res.json({ exists: count > 0, code: '', collegeName: '' });
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, roleRequest, collegeCode,
            rollNumber, year, semester, department } = req.body;

    if (await User.findOne({ email }))
      return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);

    /* ── ADMIN REGISTRATION ── */
    if (roleRequest === 'admin') {
      if (!collegeCode) {
        let code, attempts = 0;
        do { code = String(Math.floor(1000 + Math.random() * 9000)); attempts++; }
        while (await User.findOne({ adminCollegeCode: code }) && attempts < 20);

        const admin = await User.create({
          name, email, password: hashed, phone,
          role: 'admin', roleRequest: 'admin', approvalStatus: 'approved', isActive: true,
          adminCollegeCode: code, collegeCode: code,
        });
        
        await College.create({ code, collegeName: name + "'s College", adminUser: admin._id });
        return res.json({ token: sign(admin), user: admin, generatedCode: code });
      }

      const existingAdmin = await User.findOne({ role: 'admin', adminCollegeCode: collegeCode }).select('_id name email');
      if (existingAdmin) {
        return res.json({ status: 'exists', admin: existingAdmin, collegeCode });
      }

      const admin = await User.create({
        name, email, password: hashed, phone,
        role: 'admin', roleRequest: 'admin', approvalStatus: 'approved', isActive: true,
        adminCollegeCode: collegeCode, collegeCode,
      });
      
      await College.create({ code: collegeCode, collegeName: name + "'s College", adminUser: admin._id });
      return res.json({ token: sign(admin), user: admin, generatedCode: null });
    }

    /* ── FOOLPROOF STUDENT / TEACHER / HOD REGISTRATION ── */
    if (!collegeCode) return res.status(400).json({ message: 'College code is required' });

    // Look for the Admin who owns this code. If the Admin exists, the college is fully active!
    const targetAdmin = await User.findOne({ role: 'admin', adminCollegeCode: collegeCode });
    if (!targetAdmin) return res.status(400).json({ message: 'Invalid college code. Check with your admin.' });

    const isStudent = roleRequest === 'student';
    const user = await User.create({
      name, email, password: hashed, phone,
      role: 'student', // Start internally as student
      roleRequest: roleRequest || 'student',
      approvalStatus: isStudent ? 'approved' : 'pending',
      isActive: isStudent,
      collegeCode: targetAdmin.adminCollegeCode,
      ...(isStudent && { rollNumber, year: Number(year), semester: Number(semester), department }),
    });

    if (!isStudent)
      return res.json({ pending: true, message: `Your ${roleRequest} request is submitted. Await admin approval.` });

    res.json({ token: sign(user), user });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/request-admin', async (req, res) => {
  try {
    const { name, email, password, phone, collegeCode, targetAdminId } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({
      name, email, password: hashed, phone,
      role: 'student', roleRequest: 'admin', approvalStatus: 'pending', isActive: false, collegeCode,
    });
    await AdminRequest.create({ requester: user._id, targetAdmin: targetAdminId, collegeCode, status: 'pending' });
    res.json({ message: 'Admin access request submitted. Await approval.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    if (user.approvalStatus === 'pending')
      return res.status(403).json({ message: 'Account pending approval', approvalStatus: 'pending' });
    if (user.approvalStatus === 'rejected')
      return res.status(403).json({ message: `Rejected: ${user.rejectionReason || 'Contact admin'}`, approvalStatus: 'rejected' });
    if (!user.isActive)
      return res.status(403).json({ message: 'Account deactivated.', approvalStatus: 'inactive' });
    res.json({ token: sign(user), user });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.get('/me', async (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
  try {
    const { id } = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    const user   = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch { res.status(401).json({ message: 'Invalid token' }); }
});

module.exports = router;