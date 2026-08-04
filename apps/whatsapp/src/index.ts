import { conectar, encerrar } from './conexao.js'
import { subirServidor } from './servidor.js'

// Mesma razão dos outros módulos: rodando via `tsx`, o carregamento automático do .env não
// é garantido em checkout limpo.
try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env no diretório: as variáveis podem vir do ambiente (é o caso no contêiner).
}

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error(
    'AUTH_SECRET ausente ou curto demais. Copie o .env do Alojamentos — os módulos precisam\n' +
      'do MESMO valor para conseguirem conversar.',
  )
  process.exit(1)
}

const servidor = subirServidor()

await conectar()

console.log(
  'Para parear o celular: abra o Alojamentos em Configurações → WhatsApp e leia o QR\n' +
    'em Aparelhos conectados, no WhatsApp do celular corporativo.',
)

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    console.log('\n[whatsapp] encerrando…')
    encerrar()
    servidor.close(() => process.exit(0))
    // Se alguma conexão ficar pendurada, não deixa o processo preso para sempre.
    setTimeout(() => process.exit(0), 3000).unref()
  })
}
