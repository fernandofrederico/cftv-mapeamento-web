const CONFIG_PREFIX = 'CFTV_CONFIG_V1:';

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  return Buffer.from(
    normalized + padding,
    'base64'
  ).toString('utf8');
}

function normalizeBcryptHash(value) {
  let hash = String(value || '').trim();

  const quotedWithDouble =
    hash.startsWith('"') && hash.endsWith('"');

  const quotedWithSingle =
    hash.startsWith("'") && hash.endsWith("'");

  if (quotedWithDouble || quotedWithSingle) {
    hash = hash.slice(1, -1).trim();
  }

  return hash.replace(/\\\$/g, '$');
}

function decodeHashBase64(value) {
  const encoded = String(value || '').trim();

  if (!encoded) {
    return '';
  }

  return Buffer.from(encoded, 'base64')
    .toString('utf8')
    .trim();
}

function readPackedConfig() {
  const rawValue = String(
    process.env.ADMIN_PASSWORD_HASH || ''
  ).trim();

  if (!rawValue.startsWith(CONFIG_PREFIX)) {
    return null;
  }

  try {
    const encoded = rawValue.slice(CONFIG_PREFIX.length);
    const parsed = JSON.parse(decodeBase64Url(encoded));

    if (
      parsed.version !== 1 ||
      typeof parsed.adminPasswordHash !== 'string' ||
      !parsed.database ||
      typeof parsed.database !== 'object'
    ) {
      throw new Error('estrutura inválida');
    }

    return parsed;
  } catch {
    throw new Error(
      'Pacote CFTV_CONFIG_V1 inválido ou corrompido.'
    );
  }
}

function getRuntimeConfig() {
  const packedConfig = readPackedConfig();

  const adminPasswordHash = normalizeBcryptHash(
    packedConfig?.adminPasswordHash ||
    decodeHashBase64(
      process.env.ADMIN_PASSWORD_HASH_B64
    ) ||
    process.env.ADMIN_PASSWORD_HASH
  );

  const packedDatabase = packedConfig?.database || {};

  const database = {
    host: String(
      packedDatabase.host ||
      process.env.DB_HOST ||
      ''
    ).trim(),

    port: Number(
      packedDatabase.port ||
      process.env.DB_PORT ||
      3306
    ),

    user: String(
      packedDatabase.user ||
      process.env.DB_USER ||
      ''
    ).trim(),

    password: String(
      packedDatabase.password ||
      process.env.DB_PASSWORD ||
      ''
    ),

    database: String(
      packedDatabase.name ||
      process.env.DB_NAME ||
      ''
    ).trim(),
  };

  return {
    source: packedConfig ? 'pacote-v1' : 'variaveis',
    adminPasswordHash,
    database,
  };
}

module.exports = {
  getRuntimeConfig,
};
