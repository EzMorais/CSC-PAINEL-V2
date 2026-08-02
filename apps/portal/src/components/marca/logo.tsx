/**
 * Ícone da Construtora Siqueira Campos — recortado da arte oficial (hexágono com "S/C"),
 * a mesma nos quatro sistemas. A cor de cada módulo aparece nos botões e nos destaques da
 * navegação, não na marca: a logo da empresa não muda de cor.
 */
export function Marca({ className = 'size-8' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- ícone decorativo pequeno, reusado
  // em vários tamanhos via `className`; next/image exigiria largura/altura fixas por uso.
  return <img src="/marca-icone.png" alt="Construtora Siqueira Campos" className={`${className} object-contain`} />
}
