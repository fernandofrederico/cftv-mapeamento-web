const mysql = require('mysql2/promise');

const {
  getRuntimeConfig,
} = require('./runtime-config');

let pool;

function getDatabasePool() {
  if (pool) {
    return pool;
  }

  const runtimeConfig = getRuntimeConfig();
  const databaseConfig = runtimeConfig.database;

  const missingSettings = [];

  if (!databaseConfig.host) {
    missingSettings.push('DB_HOST');
  }

  if (!databaseConfig.user) {
    missingSettings.push('DB_USER');
  }

  if (!databaseConfig.password) {
    missingSettings.push('DB_PASSWORD');
  }

  if (!databaseConfig.database) {
    missingSettings.push('DB_NAME');
  }

  if (missingSettings.length > 0) {
    throw new Error(
      `Configurações do banco ausentes: ${missingSettings.join(', ')}`
    );
  }

  const mysqlHost =
    databaseConfig.host === 'localhost'
      ? '127.0.0.1'
      : databaseConfig.host;

  pool = mysql.createPool({
    host: mysqlHost,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
  });

  return pool;
}

module.exports = {
  getDatabasePool,
};
