const mongoose = require('mongoose');
module.exports = mongoose.model('CollegeCode', new mongoose.Schema({
  _id:         { type: String, default: 'singleton' },
  code:        { type: String, required: true },
  collegeName: String,
  updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));