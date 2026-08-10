import Image from 'next/image'

/**
 * Ícone da Construtora Siqueira Campos — recortado da arte oficial (hexágono com "S/C"),
 * a mesma nos quatro sistemas. A cor de cada módulo aparece nos botões e nos destaques da
 * navegação, não na marca: a logo da empresa não muda de cor.
 */
export function Marca({ className = 'size-8' }: { className?: string }) {
  return <Image src="/marca-icone.png" alt="Construtora Siqueira Campos" width={32} height={32} className={`${className} object-contain`} />
}
