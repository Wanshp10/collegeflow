const mongoose = require('mongoose');
const ref = (m) => ({ type: mongoose.Schema.Types.ObjectId, ref: m });
module.exports = mongoose.model('Attendance', new mongoose.Schema({
  student:  { ...ref('User'),    required: true },
  section:  { ...ref('Section'), required: true },
  session:  ref('QRSession'),
  date:     { type: Date, default: Date.now },
  status:   { type: String, enum: ['present','absent','late'], default: 'present' },
  markedBy: { type: String, enum: ['qr','manual'], default: 'qr' },
}, { timestamps: true }));