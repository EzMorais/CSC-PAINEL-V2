/**
 * Servidores de saída dos provedores comuns.
 *
 * Ficam aqui prontos para o almoxarife não precisar procurar "smtp do gmail" na internet e
 * colar um endereço errado — a única coisa que ele digita é o e-mail e a senha de
 * aplicativo. "OUTRO" existe para quem usa e-mail próprio da empresa, e aí os campos
 * aparecem para preencher à mão.
 */
export const PROVEDOR_EMAIL = {
  GMAIL: 'GMAIL',
  OUTLOOK: 'OUTLOOK',
  OUTRO: 'OUTRO',
} as const

export type ProvedorEmail = (typeof PROVEDOR_EMAIL)[keyof typeof PROVEDOR_EMAIL]

export const ROTULO_PROVEDOR: Record<ProvedorEmail, string> = {
  GMAIL: 'Gmail / Google Workspace',
  OUTLOOK: 'Outlook / Microsoft 365',
  OUTRO: 'Outro (servidor próprio)',
}

export const SERVIDOR_PADRAO: Record<ProvedorEmail, { host: string; porta: number }> = {
  GMAIL: { host: 'smtp.gmail.com', porta: 587 },
  OUTLOOK: { host: 'smtp.office365.com', porta: 587 },
  OUTRO: { host: '', porta: 587 },
}

/**
 * O passo a passo para conseguir a senha de aplicativo.
 *
 * Os dois provedores bloqueiam login com a senha normal da conta desde que passaram a
 * exigir verificação em duas etapas — sem esta instrução na tela, a primeira tentativa
 * falha com um "usuário ou senha inválidos" que faz a pessoa achar que digitou errado.
 */
export const COMO_OBTER_SENHA: Record<ProvedorEmail, string[]> = {
  GMAIL: [
    'A conta precisa ter a verificação em duas etapas LIGADA.',
    'Acesse myaccount.google.com/apppasswords',
    'Crie uma senha de aplicativo com o nome "Almoxarifado".',
    'Copie os 16 caracteres que aparecem e cole no campo Senha aqui.',
  ],
  OUTLOOK: [
    'A conta precisa ter a verificação em duas etapas LIGADA.',
    'Acesse account.microsoft.com/security → Opções de segurança avançadas.',
    'Em "Senhas de aplicativo", crie uma nova.',
    'Copie a senha gerada e cole no campo Senha aqui.',
    'Em conta corporativa, o administrador precisa permitir SMTP AUTH.',
  ],
  OUTRO: [
    'Peça ao responsável pelo e-mail da empresa o endereço do servidor de saída (SMTP),',
    'a porta (geralmente 587) e uma conta com permissão para enviar.',
  ],
}
