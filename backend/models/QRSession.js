const mongoose = require('mongoose');
module.exports = mongoose.model('QRSession', new mongoose.Schema({
  sessionId:    { type: String, required: true, unique: true },
  section:      { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  teacher:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt:    { type: Date, required: true },
  latitude: Number, longitude: Number,
  radiusMeters: { type: Number, default: 50 },
  scannedBy: [{
    student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scannedAt: { type: Date, default: Date.now },
  }],
  finalized: { type: Boolean, default: false },
}, { timestamps: true }));