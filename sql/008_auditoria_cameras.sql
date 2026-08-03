SET NAMES utf8mb4;

ALTER TABLE cameras
  ADD COLUMN IF NOT EXISTS criado_por_nome VARCHAR(255) NULL AFTER observacoes,
  ADD COLUMN IF NOT EXISTS criado_por_email VARCHAR(255) NULL AFTER criado_por_nome,
  ADD COLUMN IF NOT EXISTS criado_em DATETIME NULL AFTER criado_por_email,
  ADD COLUMN IF NOT EXISTS atualizado_por_nome VARCHAR(255) NULL AFTER criado_em,
  ADD COLUMN IF NOT EXISTS atualizado_por_email VARCHAR(255) NULL AFTER atualizado_por_nome,
  ADD COLUMN IF NOT EXISTS atualizado_em DATETIME NULL AFTER atualizado_por_email;
