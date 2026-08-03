SET NAMES utf8mb4;

ALTER TABLE mapa_config
  ADD COLUMN IF NOT EXISTS imagem_dados LONGBLOB NULL AFTER imagem_path,
  ADD COLUMN IF NOT EXISTS imagem_mime VARCHAR(100) NULL AFTER imagem_dados;

ALTER TABLE mapa_config
  DROP COLUMN imagem_path;
