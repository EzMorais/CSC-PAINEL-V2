# Contratos de integração da Programação

Este documento registra os contratos que devem permanecer estáveis enquanto a
implementação do `painel-lucas` é consolidada em `apps/programacao`.

## Autenticação entre sistemas

Todas as rotas de integração recebem:

```http
Authorization: Bearer <jwt>
```

O token é assinado com o `AUTH_SECRET` compartilhado e contém:

```json
{
  "origem": "programacao",
  "tipo": "integracao",
  "iat": 0,
  "exp": 0
}
```

Tokens de integração não substituem o cookie de sessão do usuário. A origem é
validada pelo módulo que recebe a chamada.

## RH → Programação

```http
GET /api/integracao/funcionarios
```

Resposta:

```json
{
  "funcionarios": [
    {
      "id": "...",
      "nome": "...",
      "matricula": "...",
      "cargo": "...",
      "obraCodigo": "...",
      "departamentoNome": "...",
      "nivelObra": "..."
    }
  ]
}
```

Funcionários desligados não são retornados. A Programação usa esses dados para
sugestão de escala, mas mantém o cadastro local complementar para quem não está
no RH.

## Frota → Programação

```http
GET /api/integracao/veiculos
```

Resposta:

```json
{
  "veiculos": [
    {
      "placa": "...",
      "nome": "...",
      "motorista": "...",
      "emManutencao": false,
      "motivoManutencao": null
    }
  ]
}
```

Seguro, FIPE, multas e quilometragem permanecem exclusivos da Frota. A
Programação recebe somente os dados necessários para escalar e detectar
conflitos de manutenção.

## Portal → Programação

```http
GET /api/integracao/cadastros?tipo=MAQUINA
```

Resposta:

```json
{
  "itens": [
    {
      "id": "...",
      "tipo": "MAQUINA",
      "codigo": "...",
      "nome": "...",
      "detalhe": "...",
      "identificador": "..."
    }
  ]
}
```

Somente itens ativos são oferecidos para novas escalas. Itens antigos continuam
preservados no histórico da programação.

## Programação → Portal

```http
GET /api/integracao/resumo
```

O resumo fornece indicadores para o dashboard geral:

- pessoas escaladas hoje;
- existência e status da programação de amanhã;
- veículos/recursos de hoje;
- frentes ativas;
- dias registrados.

## Regra de indisponibilidade

Falha de RH, Frota ou Portal não pode apagar dados já salvos nem impedir a
abertura do quadro. A interface deve informar qual origem não respondeu e
manter o lançamento manual disponível.

## Regras de evolução

- Alterações de payload devem ser compatíveis com os consumidores atuais.
- Dados pessoais desnecessários não devem ser adicionados às respostas.
- A fonte oficial não deve ser duplicada sem uma regra explícita de reconciliação.
- O cadastro local continua válido para pessoas e veículos fora das fontes
  oficiais.
- Qualquer mudança de autenticação deve ser validada no Portal, RH, Frota,
  Programação e nos módulos que consomem esses endpoints.
