-- Enriquece o cadastro de cargos com a ficha funcional usada por RH, SST e gestores de obra.
-- Campos em TEXT aceitam texto multilinha; documentos_obrigatorios usa uma linha por item.
ALTER TABLE cargos ADD COLUMN descricao TEXT;
ALTER TABLE cargos ADD COLUMN responsabilidades TEXT;
ALTER TABLE cargos ADD COLUMN requisitos TEXT;
ALTER TABLE cargos ADD COLUMN documentos_obrigatorios TEXT;
