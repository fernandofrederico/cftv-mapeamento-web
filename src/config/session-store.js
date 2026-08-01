const MySQLStoreFactory = require('express-mysql-session');

const {
  getRuntimeConfig,
} = require('./runtime-config');

function createSessionStore(session) {
  const isProduction = process.env.NODE_ENV === 'production';
  const runtimeConfig = getRuntimeConfig();
  const databaseConfig = runtimeConfig.database;

  const missingVariables = [];

  if (!databaseConfig.host) {
    missingVariables.push('DB_HOST');
  }

  if (!databaseConfig.user) {
    missingVariables.push('DB_USER');
  }

  if (!databaseConfig.password) {
    missingVariables.push('DB_PASSWORD');
  }

  if (!databaseConfig.database) {
    missingVariables.push('DB_NAME');
  }

  if (missingVariables.length > 0) {
    if (isProduction) {
      throw new Error(
        `Configurações obrigatórias ausentes: ${missingVariables.join(', ')}`
      );
    }

    console.warn(
      'MySQL não configurado localmente; usando sessões em memória.'
    );

    return undefined;
  }

  const MySQLStore = MySQLStoreFactory(session);

  const mysqlHost =
    databaseConfig.host === 'localhost'
      ? '127.0.0.1'
      : databaseConfig.host;

  return new MySQLStore({
    host: mysqlHost,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.database,
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
