/** Situação do funcionário. Campo gravado, não derivado — ver comentário no schema. */
export const STATUS = {
  ATIVO: 'ATIVO',
  AFASTADO: 'AFASTADO',
  FERIAS: 'FERIAS',
  DESLIGADO: 'DESLIGADO',
} as const

export type Status = (typeof STATUS)[keyof typeof STATUS]

export const ROTULO_STATUS: Record<Status, string> = {
  ATIVO: 'Ativo',
  AFASTADO: 'Afastado',
  FERIAS: 'Férias',
  DESLIGADO: 'Desligado',
}

/** Reaproveita os tons de status já definidos em globals.css, para não inventar cor nova. */
export const TOM_STATUS: Record<Status, 'ativa' | 'atencao' | 'vencida' | 'devolvida'> = {
  ATIVO: 'ativa',
  AFASTADO: 'atencao',
  FERIAS: 'atencao',
  DESLIGADO: 'devolvida',
}

/** Tipos de evento da timeline. O valor gravado é a chave; o rótulo é só exibição. */
export const EVENTO = {
  ADMISSAO: 'ADMISSAO',
  MUDANCA_CARGO: 'MUDANCA_CARGO',
  MUDANCA_OBRA: 'MUDANCA_OBRA',
  AFASTAMENTO: 'AFASTAMENTO',
  RETORNO: 'RETORNO',
  FERIAS: 'FERIAS',
  ADVERTENCIA: 'ADVERTENCIA',
  PROMOCAO: 'PROMOCAO',
  DESLIGAMENTO: 'DESLIGAMENTO',
  OBSERVACAO: 'OBSERVACAO',
} as const

export type TipoEvento = (typeof EVENTO)[keyof typeof EVENTO]

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  ADMISSAO: 'Admissão',
  MUDANCA_CARGO: 'Mudança de cargo',
  MUDANCA_OBRA: 'Mudança de obra',
  AFASTAMENTO: 'Afastamento',
  RETORNO: 'Retorno',
  FERIAS: 'Férias',
  ADVERTENCIA: 'Advertência',
  PROMOCAO: 'Promoção',
  DESLIGAMENTO: 'Desligamento',
  OBSERVACAO: 'Observação',
}

export const TIPO_CONTRATO = ['CLT', 'PJ', 'TEMPORARIO', 'APRENDIZ'] as const
export const PARENTESCO = ['FILHO', 'CONJUGE', 'OUTRO'] as const
export const RISCO_CARGO = ['NORMAL', 'INSALUBRE', 'PERICULOSO'] as const

/**
 * A escada de comando da obra, do topo para a base.
 *
 * A ORDEM do array é a hierarquia — quem ordena por nível usa `NIVEL_OBRA.indexOf(x)`, e
 * por isso não existe uma coluna `ordem` separada para alguém esquecer de atualizar.
 *
 * É lista fixa em código, não tabela no banco, porque a escada de um canteiro não muda: em
 * dez anos ela é a mesma. Cadastro editável aqui só criaria uma tela de manutenção para
 * algo que ninguém vai manter, e abriria espaço para variações escritas de outro jeito.
 *
 * Não confundir com `Cargo` (a profissão: Pedreiro, Eletricista, Soldador) — uma pessoa é
 * Pedreiro DE PROFISSÃO e Oficial DE NÍVEL; são eixos diferentes.
 */
export const NIVEL_OBRA = [
  'GERENTE_DE_OBRAS',
  'ENGENHEIRO',
  'MESTRE_DE_OBRAS',
  'ENCARREGADO',
  'OFICIAL',
  'MEIO_OFICIAL',
  'SERVENTE_AJUDANTE',
] as const

export type NivelObra = (typeof NIVEL_OBRA)[number]

export const ROTULO_NIVEL_OBRA: Record<NivelObra, string> = {
  GERENTE_DE_OBRAS: 'Gerente de obras',
  ENGENHEIRO: 'Engenheiro(a)',
  MESTRE_DE_OBRAS: 'Mestre de obras',
  ENCARREGADO: 'Encarregado(a)',
  OFICIAL: 'Oficial',
  MEIO_OFICIAL: 'Meio-oficial',
  SERVENTE_AJUDANTE: 'Servente / Ajudante',
}

/** Os dois ramos do organograma. Todo setor pendura em um deles. */
export const RAMO_DEPARTAMENTO = ['Administrativo', 'Engenharia'] as const
export type RamoDepartamento = (typeof RAMO_DEPARTAMENTO)[number]

/**
 * Sufixo `_UNIFORME` de propósito: EPIs (`/epis`, ainda não implementado) vai precisar dos
 * seus próprios "peça"/"motivo de entrega" para `EntregaEpi`, com valores diferentes destes
 * (CA, validade). Nomes genéricos aqui colidiriam com aquele módulo mais tarde.
 */
export const PECA_UNIFORME = {
  CAMISA: 'CAMISA',
  CALCA: 'CALCA',
  CALCADO: 'CALCADO',
  OUTRO: 'OUTRO',
} as const

export type PecaUniforme = (typeof PECA_UNIFORME)[keyof typeof PECA_UNIFORME]

export const ROTULO_PECA_UNIFORME: Record<PecaUniforme, string> = {
  CAMISA: 'Camisa',
  CALCA: 'Calça',
  CALCADO: 'Calçado',
  OUTRO: 'Outro',
}

export const NORMA_TREINAMENTO = {
  NR_10: 'NR_10',
  NR_18: 'NR_18',
  NR_33: 'NR_33',
  NR_35: 'NR_35',
  OUTRA: 'OUTRA',
} as const

export type NormaTreinamento = (typeof NORMA_TREINAMENTO)[keyof typeof NORMA_TREINAMENTO]

export const ROTULO_NORMA_TREINAMENTO: Record<NormaTreinamento, string> = {
  NR_10: 'NR-10 — Segurança em eletricidade',
  NR_18: 'NR-18 — Construção civil',
  NR_33: 'NR-33 — Espaço confinado',
  NR_35: 'NR-35 — Trabalho em altura',
  OUTRA: 'Outra',
}

export const MOTIVO_ENTREGA_UNIFORME = {
  ADMISSAO: 'ADMISSAO',
  REPOSICAO: 'REPOSICAO',
  TROCA: 'TROCA',
  DANIFICADO: 'DANIFICADO',
} as const

export type MotivoEntregaUniforme = (typeof MOTIVO_ENTREGA_UNIFORME)[keyof typeof MOTIVO_ENTREGA_UNIFORME]

export const ROTULO_MOTIVO_ENTREGA_UNIFORME: Record<MotivoEntregaUniforme, string> = {
  ADMISSAO: 'Admissão',
  REPOSICAO: 'Reposição periódica',
  TROCA: 'Troca de tamanho',
  DANIFICADO: 'Peça danificada',
}

export const TIPO_EXAME = {
  ADMISSIONAL: 'ADMISSIONAL',
  PERIODICO: 'PERIODICO',
  RETORNO_TRABALHO: 'RETORNO_TRABALHO',
  DEMISSIONAL: 'DEMISSIONAL',
  MUDANCA_FUNCAO: 'MUDANCA_FUNCAO',
} as const

export type TipoExame = (typeof TIPO_EXAME)[keyof typeof TIPO_EXAME]

export const ROTULO_TIPO_EXAME: Record<TipoExame, string> = {
  ADMISSIONAL: 'Admissional',
  PERIODICO: 'Periódico',
  RETORNO_TRABALHO: 'Retorno ao trabalho',
  DEMISSIONAL: 'Demissional',
  MUDANCA_FUNCAO: 'Mudança de função',
}

export const RESULTADO_EXAME = {
  APTO: 'APTO',
  INAPTO: 'INAPTO',
  APTO_COM_RESTRICAO: 'APTO_COM_RESTRICAO',
} as const

export type ResultadoExame = (typeof RESULTADO_EXAME)[keyof typeof RESULTADO_EXAME]

export const ROTULO_RESULTADO_EXAME: Record<ResultadoExame, string> = {
  APTO: 'Apto',
  INAPTO: 'Inapto',
  APTO_COM_RESTRICAO: 'Apto com restrição',
}

/** Documentos regulatórios — da empresa ou de uma obra, não de uma pessoa. */
export const CATEGORIA_DOCUMENTO_EMPRESA = {
  PGR: 'PGR',
  PCMSO: 'PCMSO',
  LTCAT: 'LTCAT',
  APR: 'APR',
  PT: 'PT',
  FISPQ: 'FISPQ',
  ART: 'ART',
  OUTRO: 'OUTRO',
} as const

export type CategoriaDocumentoEmpresa = (typeof CATEGORIA_DOCUMENTO_EMPRESA)[keyof typeof CATEGORIA_DOCUMENTO_EMPRESA]

export const ROTULO_CATEGORIA_DOCUMENTO_EMPRESA: Record<CategoriaDocumentoEmpresa, string> = {
  PGR: 'PGR — Prog. de Gerenciamento de Riscos',
  PCMSO: 'PCMSO — Controle Médico de Saúde Ocupacional',
  LTCAT: 'LTCAT — Laudo Técnico das Condições do Ambiente',
  APR: 'APR — Análise Preliminar de Risco',
  PT: 'PT — Permissão de Trabalho',
  FISPQ: 'FISPQ — Ficha de Segurança de Produto Químico',
  ART: 'ART — Anotação de Responsabilidade Técnica',
  OUTRO: 'Outro',
}

/** Documentos pessoais de admissão — da lista que a empresa já cobra de cada funcionário. */
export const CATEGORIA_DOCUMENTO_PESSOAL = {
  RG: 'RG',
  CPF: 'CPF',
  CTPS: 'CTPS',
  PIS_PASEP: 'PIS_PASEP',
  TITULO_ELEITOR: 'TITULO_ELEITOR',
  RESERVISTA: 'RESERVISTA',
  COMPROVANTE_RESIDENCIA: 'COMPROVANTE_RESIDENCIA',
  CERTIDAO: 'CERTIDAO',
  CONTRATO_TRABALHO: 'CONTRATO_TRABALHO',
  EXAME_ADMISSIONAL: 'EXAME_ADMISSIONAL',
  DADOS_BANCARIOS: 'DADOS_BANCARIOS',
  VALE_TRANSPORTE: 'VALE_TRANSPORTE',
  OUTRO: 'OUTRO',
} as const

export type CategoriaDocumentoPessoal = (typeof CATEGORIA_DOCUMENTO_PESSOAL)[keyof typeof CATEGORIA_DOCUMENTO_PESSOAL]

export const ROTULO_CATEGORIA_DOCUMENTO_PESSOAL: Record<CategoriaDocumentoPessoal, string> = {
  RG: 'RG',
  CPF: 'CPF',
  CTPS: 'Carteira de Trabalho (CTPS)',
  PIS_PASEP: 'PIS/PASEP',
  TITULO_ELEITOR: 'Título de eleitor',
  RESERVISTA: 'Certificado de reservista',
  COMPROVANTE_RESIDENCIA: 'Comprovante de residência',
  CERTIDAO: 'Certidão de nascimento/casamento',
  CONTRATO_TRABALHO: 'Contrato de trabalho assinado',
  EXAME_ADMISSIONAL: 'Exame admissional',
  DADOS_BANCARIOS: 'Comprovante bancário',
  VALE_TRANSPORTE: 'Vale-transporte (opção/renúncia)',
  OUTRO: 'Outro',
}

export const SITUACAO_ITEM_AUDITORIA = {
  CONFORME: 'CONFORME',
  NAO_CONFORME: 'NAO_CONFORME',
  NAO_SE_APLICA: 'NAO_SE_APLICA',
} as const

export type SituacaoItemAuditoria = (typeof SITUACAO_ITEM_AUDITORIA)[keyof typeof SITUACAO_ITEM_AUDITORIA]

export const ROTULO_SITUACAO_ITEM_AUDITORIA: Record<SituacaoItemAuditoria, string> = {
  CONFORME: 'Conforme',
  NAO_CONFORME: 'Não conforme',
  NAO_SE_APLICA: 'Não se aplica',
}

export const GRAVIDADE_NC = { BAIXA: 'BAIXA', MEDIA: 'MEDIA', ALTA: 'ALTA' } as const
export type GravidadeNc = (typeof GRAVIDADE_NC)[keyof typeof GRAVIDADE_NC]
export const ROTULO_GRAVIDADE_NC: Record<GravidadeNc, string> = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' }

export const STATUS_NC = { ABERTA: 'ABERTA', EM_ANDAMENTO: 'EM_ANDAMENTO', RESOLVIDA: 'RESOLVIDA' } as const
export type StatusNc = (typeof STATUS_NC)[keyof typeof STATUS_NC]
export const ROTULO_STATUS_NC: Record<StatusNc, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDA: 'Resolvida',
}
