"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Tabela de atributos `Rótulo | Valor` — o formato de inspeção de ficha.
 *
 * ## Por que tabela e não campos soltos
 *
 * O desenho anterior desta ficha era um `<dl>` em grade de duas colunas. Perde
 * por três motivos concretos:
 *
 *  1. **Um eixo de leitura, não dois.** Na grade o olho faz ziguezague —
 *     rótulo, valor, rótulo, valor na horizontal, depois desce. Aqui os
 *     rótulos formam uma régua vertical única: varre-se a coluna da esquerda
 *     até achar o atributo e lê-se para o lado. Ficha é consulta PONTUAL, e é
 *     a isso que a régua serve.
 *  2. **O alinhamento para de quebrar.** Na grade, um valor longo quebra em
 *     duas linhas e empurra a altura da célula, desalinhando o par ao lado.
 *     Aqui a linha é a unidade — não há como desalinhar.
 *  3. **O slot secundário sob o rótulo** (`hint`) acomoda a explicação curta
 *     sem inventar layout.
 *
 * ## Sem linha de cabeçalho, de propósito
 *
 * O padrão vem do Lastro (`document-detail.tsx`,
 * `lastro-extracted-fields-panel.tsx`), onde existe `<TableHead>` — mas lá são
 * QUATRO colunas (`Campo | Valor | Status | Conf.`) e sem cabeçalho ninguém
 * sabe o que é a terceira. Com duas colunas, "Informação | Valor" ocupa altura
 * sem informar nada que a tabela já não mostre.
 *
 * ## Custo aceito
 *
 * Um atributo por linha dobra a altura em relação à grade de duas colunas.
 * Aceitável onde a ficha é destino (aba, seção dedicada), não onde ela divide
 * espaço com outra coisa.
 */

export type AttributeRow = {
  /** Chave estável da linha. */
  id: string;
  label: string;
  /** Linha secundária, menor, sob o rótulo. Para explicar, não para repetir. */
  hint?: ReactNode;
  value: ReactNode;
  /**
   * Valor monoespaçado — para identificador, chave e código, onde os
   * caracteres precisam alinhar entre linhas e a leitura é dígito a dígito.
   * Não usar em texto corrido nem em dinheiro.
   */
  mono?: boolean;
  /** Ação da própria linha (copiar, abrir), à direita do valor. */
  action?: ReactNode;
};

export function AttributeTable({
  rows,
  className,
}: {
  rows: AttributeRow[];
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-md border", className)}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0">
              <th
                scope="row"
                className="w-[38%] max-w-56 px-3 py-2 text-left align-top font-normal text-muted-foreground"
              >
                <span className="block text-xs font-medium text-foreground">{row.label}</span>
                {row.hint != null ? (
                  <span className="mt-0.5 block text-[10px] leading-tight">{row.hint}</span>
                ) : null}
              </th>
              <td className="px-3 py-2 align-top">
                <div className="flex items-start justify-between gap-2">
                  {/* Peso NORMAL no valor. O rótulo já carrega o destaque
                      (`font-medium`), e emparelhar os dois em negrito tirava a
                      hierarquia da linha — ficavam duas colunas gritando o
                      mesmo. */}
                  <span
                    className={cn(
                      "min-w-0 break-words",
                      row.mono ? "font-mono text-xs" : "text-xs",
                    )}
                  >
                    {/* `0` e `false` são valores; só nulo e string vazia viram
                        travessão. `??` sozinho deixaria o `""` passar. */}
                    {row.value == null || row.value === "" ? "—" : row.value}
                  </span>
                  {row.action != null ? (
                    <span className="shrink-0">{row.action}</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
