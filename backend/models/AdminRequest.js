const mongoose = require('mongoose');
const ref = (m) => ({ type: mongoose.Schema.Types.ObjectId, ref: m });
module.exports = mongoose.model('AdminRequest', new mongoose.Schema({
  requester:       { ...ref('User'), required: true },
  targetAdmin:     { ...ref('User'), required: true },
  collegeCode:     { type: String, required: true },
  status:          { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  rejectionReason: String,
}, { timestamps: true }));