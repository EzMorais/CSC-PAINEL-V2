-- Os usuários passaram a viver só no Portal (apps/portal).
--
-- Este módulo não confere mais senha nem guarda cadastro: ele só lê o crachá de sessão que
-- o Portal assina. Manter a tabela aqui deixaria uma segunda lista de usuários que ninguém
-- mais atualiza — e alguém acabaria cadastrando gente nela achando que serviria para algo.
DROP TABLE IF EXISTS "Usuario";
