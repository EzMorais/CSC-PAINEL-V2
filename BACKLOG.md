# Backlog — Deploy em produção (VPS)

Tarefas ordenadas para tirar o [DEPLOY.md](DEPLOY.md) do papel e colocar as 8 aplicações no
ar. Cada item também é uma issue no GitHub — label
[`deploy`](https://github.com/EzMorais/CSC-PAINEL/labels/deploy), milestone
[Deploy em produção (VPS)](https://github.com/EzMorais/CSC-PAINEL/milestone/1).

Ordem importa: os itens de 1 a 12 são sequenciais (cada um depende do anterior). Os de 13
em diante podem ser feitos em paralelo, uma vez que a stack estiver no ar.

- [ ] [1. Provisionar o VPS](https://github.com/EzMorais/CSC-PAINEL/issues/1) — escolher provedor, tamanho e IP fixo. Linux (Ubuntu/Debian).
- [ ] [2. Configurar DNS](https://github.com/EzMorais/CSC-PAINEL/issues/2) — dois registros A (`sistemas` e `frota`) apontando pro IP do VPS. (DEPLOY.md Passo 1)
- [ ] [3. Instalar Docker no VPS](https://github.com/EzMorais/CSC-PAINEL/issues/3) — `curl -fsSL https://get.docker.com | sh` + adicionar usuário ao grupo `docker`. (Passo 2)
- [ ] [4. Dar acesso do VPS ao repositório privado](https://github.com/EzMorais/CSC-PAINEL/issues/4) — token de acesso pessoal ou deploy key, e clonar o projeto. (Passo 3)
- [ ] [5. Trocar `SEUDOMINIO.com.br` pelo domínio real](https://github.com/EzMorais/CSC-PAINEL/issues/5) — `sed` em massa nos arquivos de config (nginx + `.env.example`s). (Passo 4)
- [ ] [6. Preencher o `.env` da raiz](https://github.com/EzMorais/CSC-PAINEL/issues/6) — endereços públicos (`NEXT_PUBLIC_URL_*`) usados no build de cada app. (Passo 5.0)
- [ ] [7. Preencher o `.env.production` de cada app + gerar o `AUTH_SECRET` compartilhado](https://github.com/EzMorais/CSC-PAINEL/issues/7) — mesmo valor em portal, painel-locação, rh, estoque, programação, alojamentos e whatsapp. (Passo 5.1–5.2)
- [ ] [8. Configurar o Frota](https://github.com/EzMorais/CSC-PAINEL/issues/8) — segredo próprio (não compartilhado) e senha do admin. (Passo 5.3)
- [ ] [9. (Opcional) Configurar a chave do Google Maps](https://github.com/EzMorais/CSC-PAINEL/issues/9) — autocompletar de endereço nos Alojamentos. (Passo 5.4)
- [ ] [10. Abrir as portas no firewall](https://github.com/EzMorais/CSC-PAINEL/issues/10) — VPS (`ufw`) **e** no provedor de nuvem, se ele tiver firewall próprio. (Passo 6)
- [ ] [11. Emitir o primeiro certificado HTTPS](https://github.com/EzMorais/CSC-PAINEL/issues/11) — nginx bootstrap + certbot, cobrindo os dois domínios. (Passo 7)
- [ ] [12. Subir a stack completa](https://github.com/EzMorais/CSC-PAINEL/issues/12) — `docker compose up -d --build` e acompanhar os logs. (Passo 8)
- [ ] [13. Testar o login único (SSO)](https://github.com/EzMorais/CSC-PAINEL/issues/13) — entrar no Portal e confirmar acesso direto a Painel de Locação, RH, Almoxarifado, Programação e Alojamentos sem novo login.
- [ ] [14. Testar Frota e WhatsApp isoladamente](https://github.com/EzMorais/CSC-PAINEL/issues/14) — login próprio do Frota; parear o número e confirmar que os Alojamentos conseguem mandar mensagem.
- [ ] [15. Apagar contas e dados de exemplo](https://github.com/EzMorais/CSC-PAINEL/issues/15) — em cada sistema, antes de liberar para uso real.
- [ ] [16. Configurar renovação automática do certificado](https://github.com/EzMorais/CSC-PAINEL/issues/16) — cron rodando `certbot renew` + reload do nginx. (Passo 9)
- [ ] [17. Configurar backup periódico dos bancos](https://github.com/EzMorais/CSC-PAINEL/issues/17) — agendar o script de backup dos volumes SQLite (cron/systemd timer).
- [ ] [18. Testar a restauração de um backup (dry-run)](https://github.com/EzMorais/CSC-PAINEL/issues/18) — validar que o backup do item 17 realmente volta a funcionar antes de precisar dele de verdade.
