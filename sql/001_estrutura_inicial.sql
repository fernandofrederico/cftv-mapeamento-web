SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS caixas (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo VARCHAR(100) NOT NULL,
    descricao VARCHAR(500) NOT NULL DEFAULT '',
    localizacao VARCHAR(500) NOT NULL DEFAULT '',
    pos_x DOUBLE NOT NULL DEFAULT 100,
    pos_y DOUBLE NOT NULL DEFAULT 100,
    foto_painel VARCHAR(500) NOT NULL DEFAULT '',
    foto_switch VARCHAR(500) NOT NULL DEFAULT '',
    switch_nome VARCHAR(255) NOT NULL DEFAULT '',
    switch_ip VARCHAR(45) NOT NULL DEFAULT '',
    switch_portas SMALLINT UNSIGNED NOT NULL DEFAULT 8,

    PRIMARY KEY (id),
    UNIQUE KEY uq_caixas_codigo (codigo)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS cameras (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    caixa_id INT UNSIGNED NOT NULL,
    porta SMALLINT UNSIGNED NOT NULL,
    numero VARCHAR(100) NOT NULL DEFAULT '',
    nome VARCHAR(255) NOT NULL DEFAULT '',
    ip VARCHAR(45) NOT NULL DEFAULT '',
    localizacao VARCHAR(500) NOT NULL DEFAULT '',
    observacoes VARCHAR(2000) NOT NULL DEFAULT '',

    PRIMARY KEY (id),
    UNIQUE KEY uq_cameras_caixa_porta (caixa_id, porta),

    CONSTRAINT fk_cameras_caixa
        FOREIGN KEY (caixa_id)
        REFERENCES caixas (id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS diagram_nodes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    node_type VARCHAR(100) NOT NULL,
    label VARCHAR(500) NOT NULL DEFAULT '',
    pos_x DOUBLE NOT NULL DEFAULT 0,
    pos_y DOUBLE NOT NULL DEFAULT 0,
    size INT UNSIGNED NOT NULL DEFAULT 72,
    font_size INT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS diagram_links (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    start_node_id INT UNSIGNED NOT NULL,
    end_node_id INT UNSIGNED NOT NULL,
    line_width DOUBLE NOT NULL DEFAULT 3,
    line_color VARCHAR(30) NOT NULL DEFAULT '#2f86c1',
    line_style VARCHAR(30) NOT NULL DEFAULT 'solid',

    PRIMARY KEY (id),
    KEY idx_diagram_links_start_node (start_node_id),
    KEY idx_diagram_links_end_node (end_node_id),

    CONSTRAINT fk_diagram_links_start_node
        FOREIGN KEY (start_node_id)
        REFERENCES diagram_nodes (id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_diagram_links_end_node
        FOREIGN KEY (end_node_id)
        REFERENCES diagram_nodes (id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
