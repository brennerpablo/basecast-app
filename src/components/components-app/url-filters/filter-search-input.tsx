"use client";

import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FilterSearchInputProps {
  /** O valor que está na URL. */
  value: string;
  /** Grava na URL (com debounce). Recebe `null` quando o campo fica vazio. */
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  /** Espera depois da última tecla antes de gravar. Default 300 ms. */
  debounceMs?: number;
}

/**
 * Busca de uma barra de filtros cujo valor mora na URL.
 *
 * Cada barra (CRM, Ações, Processos, Minha Área) tinha a sua cópia de rascunho
 * local + debounce, e nenhuma acompanhava a URL depois de montada: Voltar
 * trocava o filtro e a caixa continuava mostrando o texto anterior. Aqui o
 * rascunho segue a URL sempre que ela muda por fora (Voltar, «Limpar», link),
 * e só a própria gravação — que volta igual ao que foi enviado — é ignorada.
 * O campo nunca remonta, então o foco não sai no meio da digitação.
 */
export function FilterSearchInput({
  value,
  onValueChange,
  placeholder,
  className,
  debounceMs = 300,
}: FilterSearchInputProps) {
  const [rascunho, setRascunho] = useState(value);
  const enviado = useRef<string | null>(null);

  const gravar = useDebouncedCallback((texto: string) => {
    enviado.current = texto;
    onValueChange(texto || null);
  }, debounceMs);

  // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change reason: a URL é fonte externa (Voltar, «Limpar», link); o rascunho só a segue quando a mudança não é o eco da própria gravação
  useEffect(() => {
    if (value === enviado.current) return;
    gravar.cancel();
    setRascunho(value);
  }, [value, gravar]);

  return (
    <Input
      type="search"
      placeholder={placeholder}
      value={rascunho}
      onChange={(e) => {
        setRascunho(e.target.value);
        gravar(e.target.value);
      }}
      className={cn("h-8 w-full text-xs", className)}
    />
  );
}
