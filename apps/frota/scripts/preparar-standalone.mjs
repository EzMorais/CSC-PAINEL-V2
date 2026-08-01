// O build standalone não copia static/public sozinho. Este passo fecha o pacote
// para que .next/standalone rode isolado no servidor.
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.cwd();
const alvo = path.join(raiz, '.next', 'standalone');

const copiar = (de, para) => {
  if (!fs.existsSync(de)) return false;
  fs.cpSync(de, para, { recursive: true });
  return true;
};

copiar(path.join(raiz, '.next', 'static'), path.join(alvo, '.next', 'static'));
copiar(path.join(raiz, 'public'), path.join(alvo, 'public'));

for (const arquivo of ['.env']) {
  const de = path.join(raiz, arquivo);
  if (fs.existsSync(de)) fs.copyFileSync(de, path.join(alvo, arquivo));
}

fs.mkdirSync(path.join(alvo, 'dados'), { recursive: true });
fs.mkdirSync(path.join(alvo, 'public', 'anexos'), { recursive: true });

console.log('Pacote standalone pronto em .next/standalone');
