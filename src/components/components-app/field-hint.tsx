"use client";

import { HelpCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Explicação de um campo, ao lado do rótulo.
 *
 * Existe para tirar prosa permanente dos formulários. A regra que a acompanha:
 * **o hint explica o campo; linha inline só para condição que o utilizador não
 * consegue ver** (série parada, divergência com a cota, valor fora do padrão).
 *
 * A diferença importa. Explicação é sempre a mesma e o operador lê uma vez;
 * mantê-la na tela custa altura em todas as aberturas seguintes. Condição muda
 * com o dado e é a única coisa que ele não descobre sozinho.
 *
 * Forma tirada de `/admin/styles` → `forms-showcase.tsx`, que é onde o app
 * declara como um rótulo com ajuda deve parecer.
 */
export function FieldHint({ children }: { children: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            // O texto vai no `aria-label` porque `TooltipContent` não é lido por
            // leitor de ecrã quando o gatilho não tem nome acessível próprio.
            aria-label={children}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <HelpCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
