# Alojamentos — contrato da migração

O módulo Go usa o prefixo `/alojamentos` e o banco compartilhado. Preserva os fluxos do
aplicativo Next.js: cadastro de alojamentos e quartos, ocupação sem exceder camas, uma única
alocação ativa por funcionário, encerramento histórico, transporte/telefone, rotas de ônibus,
pedidos e sua progressão de status, programação geral ou por alojamento e vínculo do grupo
de WhatsApp. Obras e funcionários são referenciados diretamente das tabelas compartilhadas.

Inativar alojamento/quarto/rota impede novos usos, sem apagar moradores ou histórico. Um
quarto lotado recusa nova alocação. A saída não pode anteceder a entrada. Pedidos atendidos
ou cancelados registram responsável e data. Programação pode ser excluída por ser quadro de
avisos, enquanto alocações e pedidos permanecem como histórico.
