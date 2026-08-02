require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { createSessionStore } = require('./config/session-store');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const caixasRoutes = require('./routes/caixas');
const mapaRoutes = require('./routes/mapa');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const sessionStore = createSessionStore(session);

if (isProduction) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(helmet());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(
  session({
    name: 'cftv.sid',
    ...(sessionStore ? { store: sessionStore } : {}),
    secret:
      process.env.SESSION_SECRET ||
      'chave-apenas-para-desenvolvimento-local',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    aplicacao: 'CFTV Mapeamento Web',
  });
});

app.get('/', (req, res) => {
  if (req.session.usuario) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/login');
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(caixasRoutes);
app.use(mapaRoutes);

app.use((req, res) => {
  res.status(404).send('Página não encontrada.');
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send('Erro interno do servidor.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CFTV Mapeamento Web iniciado na porta ${PORT}`);
});
