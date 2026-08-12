import 'server-only';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * O nome do cookie é o mesmo dos outros módulos — não troque.
 *
 * Integração ao SSO decidida em 2026-08-11 (ver ERP_BRIEFING_MELHORIA.md): o Frota deixou de
 * ter login e tabela de usuários próprios — quem confere e-mail/senha é o Portal, igual ao
 * RH/Painel/Almoxarifado/Alojamentos. Mesmo padrão de `apps/rh/src/lib/auth.ts`. A tabela
 * `usuarios` em `src/db/schema.ts` continua existindo (não foi removida por segurança), mas
 * nada aqui a consulta mais.
 */
const COOKIE = 'locacao_sessao';

/** Onde o Portal responde. É ele quem tem a tela de login. */
const URL_PORTAL = process.env.NEXT_PUBLIC_URL_PORTAL ?? 'http://localhost:3004';
const URL_APP = process.env.NEXT_PUBLIC_URL_APP ?? 'http://localhost:3000';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const MODULO_FROTA = 'FROTA';

function segredo() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou curto demais. Todos os módulos precisam do MESMO valor — ' +
        'é ele que faz o login do Portal valer aqui.',
    );
  }
  return new TextEncoder().encode(s);
}

/** Sessão crua, como veio do crachá — antes de checar se o módulo Frota está liberado. */
export type SessaoBase = { id: string; nome: string; email: string; cargo: string; modulos: string[] };

/**
 * ADMIN/DIRETORIA do Portal veem tudo por definição do cargo (mesma regra de
 * `apps/portal/src/lib/auth.ts#temAcesso`); qualquer outro cargo precisa do módulo FROTA
 * marcado explicitamente pra pessoa no Portal.
 */
export function temAcessoFrota(s: SessaoBase): boolean {
  return s.cargo === 'ADMIN' || s.cargo === 'DIRETORIA' || s.modulos.includes(MODULO_FROTA);
}

/**
 * Lê o crachá emitido pelo Portal, sem checar se o módulo Frota está liberado — a UI usa
 * isto pra diferenciar "não logado em lugar nenhum" (manda pro login) de "logado mas sem
 * este módulo" (mostra aviso, não redireciona pra um loop de login).
 */
export async function lerSessaoBase(): Promise<SessaoBase | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    return {
      id: String(payload.id),
      nome: String(payload.nome),
      email: String(payload.email),
      cargo: String(payload.cargo ?? payload.papel ?? 'CONSULTA'),
      modulos: Array.isArray(payload.modulos) ? payload.modulos.map(String) : [],
    };
  } catch {
    // Assinatura inválida, expirado ou adulterado — tudo vira "não autenticado".
    return null;
  }
}

/**
 * Frota não tem mais cargo próprio (ADMIN/OPERADOR era uma tabela separada) — ADMIN aqui é
 * ADMIN/DIRETORIA do Portal, o resto (só alcança esta tela com o módulo liberado) vira
 * OPERADOR, mesmo texto e mesma checagem (`s.papel !== 'ADMIN'`) que o resto do app já usa.
 */
export type Sessao = { id: string; nome: string; email: string; papel: 'ADMIN' | 'OPERADOR' };

function paraSessao(base: SessaoBase): Sessao {
  const admin = base.cargo === 'ADMIN' || base.cargo === 'DIRETORIA';
  return { id: base.id, nome: base.nome, email: base.email, papel: admin ? 'ADMIN' : 'OPERADOR' };
}

/** Sessão só se o módulo Frota estiver liberado — o que o resto do app usa. */
export async function lerSessao(): Promise<Sessao | null> {
  const base = await lerSessaoBase();
  if (!base || !temAcessoFrota(base)) return null;
  return paraSessao(base);
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

/** Manda para o login do Portal, guardando para onde a pessoa queria ir. */
export function urlDeLogin(destino = '/'): string {
  // `new URL('/veiculos', URL_APP)` descarta o pathname de URL_APP. Ao publicar a Frota
  // sob /frota, preservamos esse prefixo antes de montar o destino de volta pós-login.
  const caminho = `${BASE_PATH}${destino.startsWith('/') ? destino : `/${destino}`}`;
  return `${URL_PORTAL}/entrar?destino=${encodeURIComponent(new URL(caminho, URL_APP).toString())}`;
}

/**
 * Piso de toda escrita (Server Actions) — redireciona pro login do Portal se a sessão faltar
 * OU se o módulo Frota não estiver liberado. Quem precisa distinguir os dois casos pra
 * mostrar uma mensagem melhor é a UI (`(app)/layout.tsx`), não uma action.
 */
export async function exigirSessao(): Promise<Sessao> {
  const s = await lerSessao();
  if (!s) redirect(urlDeLogin('/veiculos'));
  return s;
}
