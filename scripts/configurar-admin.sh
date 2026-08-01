#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

read -r -p "E-mail do administrador: " ADMIN_EMAIL

if [[ ! "$ADMIN_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "E-mail inválido."
  exit 1
fi

read -r -s -p "Senha do administrador: " ADMIN_PASSWORD
echo

read -r -s -p "Confirme a senha: " ADMIN_PASSWORD_CONFIRM
echo

if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; then
  echo "As senhas não coincidem."
  exit 1
fi

if [ "${#ADMIN_PASSWORD}" -lt 10 ]; then
  echo "A senha deve possuir pelo menos 10 caracteres."
  exit 1
fi

SESSION_SECRET="$(
  node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))"
)"

ADMIN_PASSWORD_HASH="$(
  ADMIN_PASSWORD="$ADMIN_PASSWORD" node -e "
    const bcrypt = require('bcryptjs');
    bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
      .then(hash => process.stdout.write(hash))
      .catch(error => {
        console.error(error);
        process.exit(1);
      });
  "
)"

cat > .env <<ENV
NODE_ENV=development
PORT=3000

SESSION_SECRET=$SESSION_SECRET
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD_HASH=$ADMIN_PASSWORD_HASH
ENV

chmod 600 .env

unset ADMIN_PASSWORD
unset ADMIN_PASSWORD_CONFIRM
unset ADMIN_PASSWORD_HASH

echo "Credenciais locais configuradas com segurança."
