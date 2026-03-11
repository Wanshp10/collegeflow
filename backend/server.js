require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true 
}));
app.use(express.json());

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/hod',     require('./routes/hod'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/student', require('./routes/student'));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/attendease')
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 Server on port ${process.env.PORT || 5000}`));
  })
  .catch(err => { console.error(err); process.exit(1); });