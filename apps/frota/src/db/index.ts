import 'server-only';

// Fachada usada pelo Next. O guard impede que o banco vaze para um Client
// Component; scripts de linha de comando importam ./conexao diretamente.
export { db } from './conexao';
export * from './schema';
