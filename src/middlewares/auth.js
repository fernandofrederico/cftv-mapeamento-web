function requireAuth(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }

  res.locals.usuario = req.session.usuario;
  return next();
}

function requireGuest(req, res, next) {
  if (req.session.usuario) {
    return res.redirect('/dashboard');
  }

  return next();
}

module.exports = {
  requireAuth,
  requireGuest,
};
