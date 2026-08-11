import { redirect } from 'next/navigation';
import { urlDeLogin } from '@/lib/auth';

/**
 * Não existe mais tela de login própria aqui — quem confere e-mail/senha é o Portal (SSO,
 * decisão de 2026-08-11). Esta rota fica só como redirecionamento gentil pra quem tinha o
 * endereço salvo.
 */
export default function Entrar() {
  redirect(urlDeLogin('/veiculos'));
}
