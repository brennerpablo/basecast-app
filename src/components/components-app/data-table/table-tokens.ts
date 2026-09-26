/**
 * Colunas de código — CNPJ/CPF, ticker, ISIN, CODANBID.
 *
 * Monoespaçada porque isto é um identificador, não um número que se soma: os
 * dígitos alinham entre as linhas e a máscara (`00.000.000/0000-00`) fica
 * legível. `whitespace-nowrap` impede que a máscara quebre no meio.
 *
 * Aplicar via `columnClassName`, que pega `<th>` e `<td>` — e não num span
 * dentro do `formatter`, senão o cabeçalho fica fora do padrão e qualquer
 * `cell` override apaga o estilo. Para colunas com link, o equivalente é
 * `link.variant: "mono"` (ou `"asset"` para ticker de ativo).
 */
export const CODE_COLUMN_CLASS = "font-mono whitespace-nowrap";
