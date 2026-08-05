/**
 * Importação única do cadastro de funcionários e veículos, vindo da planilha em uso hoje.
 *
 * Roda uma vez (`npx tsx scripts/importar-cadastro.ts`), não faz parte do fluxo normal do
 * app. `upsert` por nome/modelo é de propósito: rodar de novo depois de ajustar um dado na
 * lista abaixo não duplica quem já foi importado.
 */
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env no diretório: a variável pode vir do ambiente.
}

const prisma = new PrismaClient()

type LinhaFuncionario = { nome: string; funcaoSigla: string; tipo: 'CSC' | 'PRESTADOR' }

const FUNCIONARIOS: LinhaFuncionario[] = [
  { nome: 'Adenilson Dos Santos Silva', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Ailton Pereira De Oliveira', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Alaecio De Ribamar Simões', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Antonio Dos Reis Santos', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Antonio Dos Santos Sampaio', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Antonio Elenilson Dos Santos Freitas', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Aparecido Fernandes De Campos', funcaoSigla: 'EO', tipo: 'CSC' },
  { nome: 'Carlos Daniel Silva De Meneses', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Carolina Maciel Lucas', funcaoSigla: 'EF', tipo: 'CSC' },
  { nome: 'Cicero Martiliano Gouveia', funcaoSigla: 'MOT', tipo: 'CSC' },
  { nome: 'Claus Soares Da Costa Passos', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Cristina Silva Vicente', funcaoSigla: 'RH', tipo: 'CSC' },
  { nome: 'Daniel Conceição Da Silva', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Daniel Oliveira Dos Santos', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Dariel Ladson Nunes De Amorim', funcaoSigla: 'CP', tipo: 'CSC' },
  { nome: 'Denilson De Jesus Barbosa Costa', funcaoSigla: '1/2 PD', tipo: 'CSC' },
  { nome: 'Dirceu Vaz Machado', funcaoSigla: 'EO', tipo: 'CSC' },
  { nome: 'Edinilson Cravo De Oliveira', funcaoSigla: 'LC', tipo: 'CSC' },
  { nome: 'Eduardo Silva De França', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Enzo Hiroshi Morais Shibaki', funcaoSigla: 'ADM', tipo: 'CSC' },
  { nome: 'Franciel De Jesus Do Nascimento', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Francisco Cardoso De Meneses Filho', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Francisco Cesar Dos Santos Nascimento', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Francisco De Sousa Gomes', funcaoSigla: 'EO', tipo: 'CSC' },
  { nome: 'Francisco Gleison Da Silva Amorim', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Francisco Kevem Amorim Da Costa', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Francisco Romulo Da Silva Caldas', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Gabriel Rodrigues Xavier', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Gilberto Aparecido Alves', funcaoSigla: 'PT', tipo: 'CSC' },
  { nome: 'Giovani Cezar Simplicio', funcaoSigla: 'OP.RETRO', tipo: 'CSC' },
  { nome: 'Gustavo Oliveira Costa', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Helcio Vieira', funcaoSigla: 'EO', tipo: 'CSC' },
  { nome: 'Herbert Anunciação De Oliveira', funcaoSigla: '1/2 MT', tipo: 'CSC' },
  { nome: 'Ismael Bruno De Souza Cardoso', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Ivanilson Francisco De Sousa', funcaoSigla: '1/2 PD', tipo: 'CSC' },
  { nome: 'Izael Teixeira De França', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Janciel Alves Barbosa', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Jardenilson Silva Vieira', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Jesse Ayres De Campos', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Jessica Roberta Oliveira Bigue', funcaoSigla: 'ARQ', tipo: 'CSC' },
  { nome: 'João Carvalho Azevedo', funcaoSigla: 'PT', tipo: 'CSC' },
  { nome: 'João Gabriel De Queiroz Schneider', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Joel Pereira Da Silva', funcaoSigla: 'CP', tipo: 'CSC' },
  { nome: 'Jonas Cardoso Santos', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Jose Aparecido Galvão', funcaoSigla: 'OP.RETRO', tipo: 'CSC' },
  { nome: 'Jose Armando Coelho Livramento', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Jose Barbosa De Carvalho', funcaoSigla: 'EO', tipo: 'CSC' },
  { nome: 'Jose Carlos Silva Leao', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Jose Fontinele Coelho', funcaoSigla: 'LO', tipo: 'CSC' },
  { nome: 'Jose Nadilson Bispo Dos Santos', funcaoSigla: 'CP', tipo: 'CSC' },
  { nome: 'Jose Nilton Dos Santos', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Jose Romildo Santos De Souza', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Junior Ferreira Da Silva', funcaoSigla: 'EP', tipo: 'CSC' },
  { nome: 'Kanando Francisco De Sousa Santos', funcaoSigla: 'MT', tipo: 'CSC' },
  { nome: 'Leonidas Da Silva Caldas', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Lucas Maier São Pedro Antunes Bastos', funcaoSigla: 'ADM', tipo: 'CSC' },
  { nome: 'Luciano Nascimento De Sousa', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Luis Gonzaga Da Silva Mendes', funcaoSigla: 'CP', tipo: 'CSC' },
  { nome: 'Luis Henrique Sampaio Pereira', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Luiz De Assis Da Silva', funcaoSigla: 'MOT', tipo: 'CSC' },
  { nome: 'Luiz Fernando Oliveira Dos Santos', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Luiz Rodrigues De França Junior', funcaoSigla: '1/2 PD', tipo: 'CSC' },
  { nome: 'Manoel Do Nascimento Moreira', funcaoSigla: 'EO', tipo: 'CSC' },
  { nome: 'Manuela Zaidan Leme', funcaoSigla: 'ADM', tipo: 'CSC' },
  { nome: 'Marcelo Alves Da Gama', funcaoSigla: 'CP', tipo: 'CSC' },
  { nome: 'Marcelo Da Costa Lima', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Marcio Domingos Rodrigues', funcaoSigla: 'ALM', tipo: 'CSC' },
  { nome: 'Maria Vitoria Scura De Souza', funcaoSigla: 'ADM', tipo: 'CSC' },
  { nome: 'Mariana Abdala Melo', funcaoSigla: 'AP', tipo: 'CSC' },
  { nome: 'Mariana De Almeida Nascimento', funcaoSigla: 'AE', tipo: 'CSC' },
  { nome: 'Marinaldo Da Silva Fernandes', funcaoSigla: '1/2 PD', tipo: 'CSC' },
  { nome: 'Mauricio De Melo Torres', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Mauricio Franco', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Mauricio Silva De Oliveira', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Mirele Moreira Farrapo Pagliato', funcaoSigla: 'ADM', tipo: 'CSC' },
  { nome: 'Neurandir Ramos Correia', funcaoSigla: 'SOLD', tipo: 'CSC' },
  { nome: 'Paulo Henrique Bertin', funcaoSigla: 'SUPO', tipo: 'CSC' },
  { nome: 'Pedro De Jesus Rodrigues', funcaoSigla: '1/2 PD', tipo: 'CSC' },
  { nome: 'Pedro Gomes Dos Santos', funcaoSigla: 'EO', tipo: 'CSC' },
  { nome: 'Roberto Rocha Da Silva', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Rodrigo Moreira De Oliveira', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Rodrigo Rocha Da Conceição', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Rogerio Lima Da Silva', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Rosendo Aparecido Santos', funcaoSigla: 'LO', tipo: 'CSC' },
  { nome: 'Ryan Jose Neto Da Silva E Silva', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Vanderley Ferreira', funcaoSigla: 'EO', tipo: 'CSC' },
  { nome: 'Vicente Barbosa Neto', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Walberto Cupertino Costa De Lima', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Welson Conceição Da Silva', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Alex Severino Da Silva', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Antonio Carlos Da Silva Gomes', funcaoSigla: 'CP', tipo: 'CSC' },
  { nome: 'Ataide Lustosa Da Costa', funcaoSigla: 'SO', tipo: 'CSC' },
  { nome: 'Francisco Filho De Oliveira Costa', funcaoSigla: '1/2 MT', tipo: 'CSC' },
  { nome: 'Luiz Marques', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Mario Orlando Silva De Oliveira', funcaoSigla: 'MT', tipo: 'CSC' },
  { nome: 'Osandi Soares Da Silva', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Rodrigo Fernandes De Lima', funcaoSigla: 'PD', tipo: 'CSC' },
  { nome: 'Adalberto Ducati Pereira', funcaoSigla: 'ELET', tipo: 'PRESTADOR' },
  { nome: 'Adriano Ferreira De Almeida', funcaoSigla: 'STST', tipo: 'PRESTADOR' },
  { nome: 'Adrivanilton Veras Oliveira', funcaoSigla: 'ELET', tipo: 'PRESTADOR' },
  { nome: 'Amalia Anelli Da Silva', funcaoSigla: 'DIAR', tipo: 'PRESTADOR' },
  { nome: 'Bruno Camargo Siqueira', funcaoSigla: 'ENG', tipo: 'PRESTADOR' },
  { nome: 'Bruno De Mello Moraes Manicardi', funcaoSigla: 'ENG', tipo: 'PRESTADOR' },
  { nome: 'Bruno Garcia Barboza De Lima', funcaoSigla: 'TST', tipo: 'PRESTADOR' },
  { nome: 'Donato Rafael Gasparro', funcaoSigla: 'PROJ', tipo: 'PRESTADOR' },
  { nome: 'Edilson Maximiano Pereira', funcaoSigla: 'PD', tipo: 'PRESTADOR' },
  { nome: 'Eliesel Domingues De Moraes', funcaoSigla: 'PD', tipo: 'PRESTADOR' },
  { nome: 'Emerson Jose Dias Duarte', funcaoSigla: 'ADM', tipo: 'PRESTADOR' },
  { nome: 'Felipe Boaventura Pacheco', funcaoSigla: 'TST', tipo: 'PRESTADOR' },
  { nome: 'Helio Ribeiro Tadei', funcaoSigla: 'MOT', tipo: 'PRESTADOR' },
  { nome: 'Joao Batista Fogaça Caetano', funcaoSigla: 'MT', tipo: 'PRESTADOR' },
  { nome: 'Joao Paulo Santos Souza', funcaoSigla: 'ENG', tipo: 'PRESTADOR' },
  { nome: 'Joao Schneider', funcaoSigla: 'EO', tipo: 'PRESTADOR' },
  { nome: 'Leandro Mendes Leroy', funcaoSigla: 'ENG', tipo: 'PRESTADOR' },
  { nome: 'Luana Cristina Schuengue Dos Santos', funcaoSigla: 'ENG', tipo: 'PRESTADOR' },
  { nome: 'Manoel Francisco Leal De Medeiros', funcaoSigla: 'SOLD', tipo: 'PRESTADOR' },
  { nome: 'Marcelo Soares De Campos', funcaoSigla: 'DIRETOR', tipo: 'PRESTADOR' },
  { nome: 'Maria Alice Leite Sclaves', funcaoSigla: 'TST', tipo: 'PRESTADOR' },
  { nome: 'Nicolas Oliveira São Pedro', funcaoSigla: 'ENG', tipo: 'PRESTADOR' },
  { nome: 'Paulo Roberto Pereira Junior', funcaoSigla: 'TE', tipo: 'PRESTADOR' },
  { nome: 'Pedro Antunes De Quevedo', funcaoSigla: 'ENG', tipo: 'PRESTADOR' },
  { nome: 'Raimundo Nonato Pereira Vieira', funcaoSigla: 'TELE', tipo: 'PRESTADOR' },
  { nome: 'Regilaine Da Silva Botelho', funcaoSigla: 'TST', tipo: 'PRESTADOR' },
  { nome: 'Rodrigo Godinho Martins', funcaoSigla: 'COMP', tipo: 'PRESTADOR' },
  { nome: 'Vanderlice Da Silva Santos', funcaoSigla: 'DIAR', tipo: 'PRESTADOR' },
]

type LinhaVeiculo = { modelo: string; placa: string | null }

const VEICULOS: LinhaVeiculo[] = [
  { modelo: 'Retroescavadeira Case - 580N SZ', placa: null },
  { modelo: 'Mini Carregadeira Case - SR200B', placa: null },
  { modelo: 'Retroescavadeira JCB 3C', placa: 'FJB3038' },
  { modelo: 'Caminhão Ford Cargo 2422cn', placa: 'EAT7J46' },
  { modelo: 'Caminhão M. Benz 915c', placa: 'EPV0634' },
  { modelo: 'Jumper M33M 23S', placa: 'FQS3I20' },
  { modelo: 'Gol 1.0L MC4', placa: 'CCU8J62' },
  { modelo: 'VW/Polo 200 TSI', placa: 'EZA5F35' },
  { modelo: 'Saveiro R8 MBVD', placa: 'ALF4F71' },
  { modelo: 'Saveiro CS TL MB', placa: 'PUV0790' },
  { modelo: 'Toro Ranch AT9 4x4 Cinza', placa: 'FDL7J85' },
  { modelo: 'Toro Ranch AT9 4x4 Branca', placa: 'STU0B20' },
  { modelo: 'Ranger XLS 12A - Prata+Velha', placa: 'DUR5D00' },
  { modelo: 'Ranger LTD 12A - Preta', placa: 'LLI8D10' },
  { modelo: 'Ranger XLT 12A - Prata', placa: 'EXZ6B55' },
  { modelo: 'Doblo Attractiv 1.4 - Cinza', placa: 'EFV8I00' },
  { modelo: 'Doblo Essence 1.8 - Prata', placa: 'GFF5B39' },
  { modelo: 'Doblo Attractiv 1.4 - Branca', placa: 'PXF4H26' },
  { modelo: 'Doblo Essence 2L 1.8 - B.+Nova', placa: 'QWY5H76' },
  { modelo: 'Doblo Essence 1.8 - Branca 1.8', placa: 'FDA1H69' },
  { modelo: 'Chev/Spin 1.8L LTZ Mec - 1', placa: 'FIX5E73' },
  { modelo: 'Chev/Spin 1.8L LTZ Mec - 2', placa: 'FOT0B25' },
  { modelo: 'Chev/Spin 1.8L LTZ Mec - 3', placa: 'FHV8A89' },
  { modelo: 'Onix - Alugado', placa: 'TJV8G34' },
]

async function main() {
  let funcionarios = 0
  for (const f of FUNCIONARIOS) {
    const existe = await prisma.funcionario.findFirst({ where: { nome: f.nome } })
    if (existe) continue
    await prisma.funcionario.create({
      data: {
        nome: f.nome, funcaoSigla: f.funcaoSigla, tipo: f.tipo,
        motorista: f.funcaoSigla === 'MOT',
      },
    })
    funcionarios++
  }

  let veiculos = 0
  for (const v of VEICULOS) {
    const existe = await prisma.veiculo.findFirst({ where: { modelo: v.modelo } })
    if (existe) continue
    await prisma.veiculo.create({ data: { modelo: v.modelo, placa: v.placa } })
    veiculos++
  }

  console.log(`Funcionários: ${FUNCIONARIOS.length} na lista (${funcionarios} criados agora)`)
  console.log(`Veículos: ${VEICULOS.length} na lista (${veiculos} criados agora)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
