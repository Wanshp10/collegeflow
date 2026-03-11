const jwt = require('jsonwebtoken');
const ROLE_LEVEL = { student: 1, teacher: 2, hod: 3, admin: 4 };

const auth = (roles = []) => (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ message: 'Forbidden' });
    next();
  } catch { res.status(401).json({ message: 'Invalid token' }); }
};

const minRole = (roleName) => (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    if ((ROLE_LEVEL[req.user.role] || 0) < (ROLE_LEVEL[roleName] || 0))
      return res.status(403).json({ message: 'Forbidden' });
    next();
  } catch { res.status(401).json({ message: 'Invalid token' }); }
};

module.exports = { auth, minRole };