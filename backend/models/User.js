const mongoose = require('mongoose');
const S = { type: String };
const userSchema = new mongoose.Schema({
  name:            { ...S, required: true, trim: true },
  email:           { ...S, required: true, unique: true, lowercase: true },
  password:        { ...S, required: true },
  phone:           S,
  role:            { ...S, enum: ['student','teacher','hod','admin'], default: 'student' },
  roleRequest:     { ...S, enum: ['student','teacher','hod','admin'] },
  approvalStatus:  { ...S, enum: ['pending','approved','rejected'], default: 'approved' },
  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: S,
  rollNumber: S, year: Number, semester: Number, department: S,
  hodDepartment: S, adminCollegeCode: S,
  collegeCode:   { ...S, index: true },
  isActive:      { type: Boolean, default: true },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);