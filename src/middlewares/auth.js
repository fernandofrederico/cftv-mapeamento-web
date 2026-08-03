function requireAuth(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }

  res.locals.usuario = req.session.usuario;
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }

  if (req.session.usuario.perfil !== 'administrador') {
    return res.status(403).send('Acesso restrito a administradores.');
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
  requireAdmin,
  requireGuest,
};
