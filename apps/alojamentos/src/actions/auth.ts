'use server'

import { redirect } from 'next/navigation'
import { encerrarSessao, urlDeLogin } from '@/lib/auth'

/**
 * Sair encerra a sessão de TODOS os módulos, não só deste.
 *
 * O crachá é um cookie só, compartilhado — apagar aqui apaga para o Portal, o RH, o Almoxarifado e o Painel
 * junto. É o comportamento certo: quem clica em "sair" num computador de obra espera ter
 * saído de tudo, não de uma aba.
 *
 * Entrar não mora mais aqui: quem confere senha é o Portal.
 */
export async function sair() {
  await encerrarSessao()
  redirect(urlDeLogin('/'))
}
