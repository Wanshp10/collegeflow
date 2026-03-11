const mongoose = require('mongoose');
const ref = (m) => ({ type: mongoose.Schema.Types.ObjectId, ref: m });
module.exports = mongoose.model('Section', new mongoose.Schema({
  name: { type: String, required: true }, 
  subject: { type: String, required: true },
  subjectCode: String, department: String, year: Number, semester: Number,
  teacher:      ref('User'), hod: ref('User'),
  students:     [ref('User')],
  totalClasses: { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true }));