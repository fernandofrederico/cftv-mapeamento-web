SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS mapa_config (
    id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    imagem_path VARCHAR(500) NOT NULL DEFAULT '',
    atualizado_em DATETIME NULL,

    PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO mapa_config (id, imagem_path) VALUES (1, '');
