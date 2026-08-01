import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, usuarios } from '@/db';

const COOKIE = 'frota_sessao';
const DIAS = 7;

function segredo() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET ausente ou curto demais. Defina uma string de 32+ caracteres no .env');
  }
  return new TextEncoder().encode(s);
}

export type Sessao = { id: number; nome: string; email: string; papel: string };

export async function criarSessao(u: Sessao) {
  const token = await new SignJWT({ ...u })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(segredo());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.FORCA_HTTPS === '1',
    path: '/',
    maxAge: DIAS * 24 * 60 * 60,
  });
}

export async function lerSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    return {
      id: Number(payload.id),
      nome: String(payload.nome),
      email: String(payload.email),
      papel: String(payload.papel),
    };
  } catch {
    return null;
  }
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

export async function autenticar(email: string, senha: string): Promise<Sessao | null> {
  const u = db.select().from(usuarios).where(eq(usuarios.email, email.toLowerCase().trim())).get();
  if (!u || !u.ativo) return null;
  if (!bcrypt.compareSync(senha, u.senhaHash)) return null;
  return { id: u.id, nome: u.nome, email: u.email, papel: u.papel };
}

/** Usar no topo de toda página/rota protegida. */
export async function exigirSessao(): Promise<Sessao> {
  const s = await lerSessao();
  if (!s) throw new Error('NAO_AUTENTICADO');
  return s;
}
