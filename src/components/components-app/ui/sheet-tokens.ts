/**
 * Larguras de sheet lateral.
 *
 * **A largura segue o CONTEÚDO, e não a ordem em que a tela foi escrita.**
 * Antes disto cada sheet escolhia a sua, e o resultado não tinha relação com o
 * que cabia dentro: 38 colunas espremidas em 1024px no visualizador de FIDC, e
 * 2 colunas folgadas nos mesmos 1024px no drill de fluxo. Quem chegava depois
 * copiava a largura do vizinho, que já estava errada.
 *
 * O teto existe porque `90vw` sozinho erra nas pontas. Num notebook de 1280 ele
 * dá 1152px, que é o que se quer; num ultrawide de 3440 dá 3096px, e aí a linha
 * fica tão larga que o olho perde o começo dela ao chegar no fim. 1600px é onde
 * uma tabela densa ainda se lê de uma passada.
 *
 * `min()` e não `clamp()`: o piso quem dá é o `w-full` do próprio `SheetContent`
 * abaixo do breakpoint `sm`, onde o sheet ocupa a tela inteira.
 */

/** Tabela densa — detalhe de parcela, visualizador de arquivo, drill. */
export const SHEET_LARGO = "sm:max-w-[min(90vw,1600px)]";

/** Formulário, leitura de um registro só, confirmação. Cabe em coluna única. */
export const SHEET_ESTREITO = "sm:max-w-xl";
