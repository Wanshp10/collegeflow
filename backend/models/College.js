const mongoose = require('mongoose');
module.exports = mongoose.model('College', new mongoose.Schema({
  code:        { type: String, required: true, unique: true },
  collegeName: String,
  adminUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));