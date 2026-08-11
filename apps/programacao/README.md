# Programação diária

Este é o módulo oficial de programação diária do `CSC-PAINEL`.

Ele incorpora a implementação originalmente desenvolvida no repositório
`painel-lucas`, que permanece como referência histórica e funcional. Não há
necessidade de manter duas implementações do quadro: alterações futuras devem
ser feitas aqui, dentro do monorepo do CSC.

## Responsabilidades

- Montar a programação de cada dia por frente de trabalho.
- Escalar funcionários, pessoas avulsas, veículos, máquinas e avisos.
- Copiar a programação anterior, respeitando funcionários inativos ou ausentes.
- Detectar conflitos de escala, motorista e manutenção de veículos.
- Publicar a programação e gerar a imagem para compartilhamento no WhatsApp.
- Manter cadastros locais complementares para pessoas e veículos que não estão
  no RH ou na Frota.

## Integrações

O módulo não substitui os cadastros oficiais dos outros sistemas:

- **Portal**: autenticação, cargos, permissões e máquinas do catálogo.
- **RH**: funcionários cadastrados oficialmente.
- **Frota**: veículos e situação de manutenção.
- **Portal/Hub**: navegação entre os módulos da empresa.

As consultas externas usam tokens JWT assinados com o mesmo `AUTH_SECRET`.
Quando um sistema não responde, o quadro continua disponível e permite o
lançamento manual.

## Desenvolvimento

```bash
npm install
echo DATABASE_URL="file:./dev.db" > .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run db:import-cadastro
npm run dev
```

O módulo roda por padrão em `http://localhost:3007`.

O importador é idempotente: ele cadastra o conjunto complementar de funcionários e
veículos usado na programação diária sem duplicar registros quando for executado de novo.
O `docker-entrypoint.sh` executa os dois passos automaticamente a cada inicialização;
em um banco existente, rode `npm run db:import-cadastro` após configurar `DATABASE_URL`.

## Regra para a integração

O schema e as regras deste módulo devem continuar compatíveis com o comportamento
validado no `painel-lucas`. Mudanças que envolvam funcionários, veículos, frentes,
programações ou imagens devem ser comparadas com a referência antes de serem
aceitas. A integração com RH e Frota é complementar: ela não deve eliminar o
cadastro local necessário para a operação diária.
