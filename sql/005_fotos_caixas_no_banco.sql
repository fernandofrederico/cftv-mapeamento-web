SET NAMES utf8mb4;

ALTER TABLE caixas
  ADD COLUMN IF NOT EXISTS foto_painel_dados LONGBLOB NULL AFTER foto_painel,
  ADD COLUMN IF NOT EXISTS foto_painel_mime VARCHAR(100) NULL AFTER foto_painel_dados,
  ADD COLUMN IF NOT EXISTS foto_switch_dados LONGBLOB NULL AFTER foto_switch,
  ADD COLUMN IF NOT EXISTS foto_switch_mime VARCHAR(100) NULL AFTER foto_switch_dados;
