const MySQLStoreFactory = require('express-mysql-session');

function createSessionStore(session) {
  const isProduction = process.env.NODE_ENV === 'production';

  const databaseConfig = {
    host: String(process.env.DB_HOST || '').trim(),
    port: Number(process.env.DB_PORT) || 3306,
    user: String(process.env.DB_USER || '').trim(),
    password: String(process.env.DB_PASSWORD || ''),
    database: String(process.env.DB_NAME || '').trim(),
  };

  const missingVariables = [];

  if (!databaseConfig.host) missingVariables.push('DB_HOST');
  if (!databaseConfig.user) missingVariables.push('DB_USER');
  if (!databaseConfig.password) missingVariables.push('DB_PASSWORD');
  if (!databaseConfig.database) missingVariables.push('DB_NAME');

  if (missingVariables.length > 0) {
    if (isProduction) {
      throw new Error(
        `Variáveis obrigatórias ausentes: ${missingVariables.join(', ')}`
      );
    }

    console.warn(
      'MySQL não configurado localmente; usando sessões em memória.'
    );

    return undefined;
  }

  const MySQLStore = MySQLStoreFactory(session);

  return new MySQLStore({
    ...databaseConfig,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 8 * 60 * 60 * 1000,
    schema: {
      tableName: 'sessoes',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  });
}

module.exports = {
  createSessionStore,
};
