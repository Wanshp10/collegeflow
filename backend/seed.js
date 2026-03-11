require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User        = require('./models/User');
const CollegeCode = require('./models/CollegeCode');
const College     = require('./models/College');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/attendease');
  if (await User.findOne({ email: 'admin@college.edu' })) {
    console.log('✅ Already seeded.'); process.exit(0);
  }
  const password = await bcrypt.hash('admin123', 12);
  const code     = 'COLLEGE2024';
  const admin    = await User.create({
    name: 'Super Admin', email: 'admin@college.edu', password,
    role: 'admin', roleRequest: 'admin', approvalStatus: 'approved',
    isActive: true, adminCollegeCode: code, collegeCode: code,
  });
  await CollegeCode.findOneAndUpdate(
    { _id: 'singleton' },
    { code, collegeName: 'Demo College of Technology', updatedBy: admin._id },
    { upsert: true }
  );
  await College.create({ code, collegeName: 'Demo College of Technology', adminUser: admin._id });
  console.log('✅ Seeded  admin@college.edu / admin123  code: COLLEGE2024');
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });