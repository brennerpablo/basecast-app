"use client";

import {
  Maximize2,
  Minimize2
} from "lucide-react";
import { Slot } from "radix-ui";
import React from "react";
import ReactDOM from "react-dom";

import { useBodyScrollLock } from "@/lib/hooks/use-body-scroll-lock";
import { cn } from "@/lib/utils";

export type AccentSide = "top" | "right" | "bottom" | "left";

/**
 * Estado de tela cheia, visível para o conteúdo do card.
 *
 * O estado é interno ao `Card`, mas o conteúdo às vezes precisa reagir a ele —
 * um gráfico de altura fixa deve crescer para ocupar o overlay. Contexto, e não
 * componente controlado: no modo controlado o botão de ABRIR só existe no
 * caminho `ghost`, então controlar de fora deixaria o card sem gatilho.
 *
 * Quem consome tem de estar DENTRO de `<Card>` na árvore — ler o hook no mesmo
 * componente que renderiza o `Card` devolve sempre `false`, porque ali o
 * provider ainda não existe.
 */
const CardFullscreenContext = React.createContext(false);

export function useCardFullscreen(): boolean {
  return React.useContext(CardFullscreenContext);
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  hoverShadow?: boolean;
  enableFullscreen?: boolean;
  /**
   * Controla o estado de tela cheia externamente (ex.: um botão fora do card).
   * Quando fornecido, o botão padrão de expandir NÃO é exibido na visão normal
   * — o gatilho fica com quem controla; o botão de sair aparece na tela cheia.
   */
  fullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Só no overlay de tela cheia: conteúdo extra abaixo de `children` (ex. tabela). */
  fullscreenChildren?: React.ReactNode;
  /**
   * Em tela cheia, mostra só `fullscreenChildren` (não duplica `children`).
   * Use quando o preview em `children` e o conteúdo expandido são equivalentes (ex.: tabela).
   */
  fullscreenExclusive?: boolean;
  /** Substitui o botão padrão de tela cheia por um gatilho customizado. */
  fullscreenTrigger?: React.ReactNode;
  ghost?: boolean;
  /**
   * Com `ghost`, mantém o card sem borda/fundo/padding também em tela cheia
   * (por padrão o ghost ganha o visual de card ao expandir). Use quando o
   * conteúdo expandido deve ocupar toda a área (ex.: grid de dashboard).
   */
  fullscreenGhost?: boolean;
  accentColor?: string;
  accentSide?: AccentSide;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      asChild = false,
      hoverShadow = false,
      enableFullscreen = false,
      fullscreen,
      onFullscreenChange,
      fullscreenChildren,
      fullscreenExclusive = false,
      fullscreenTrigger,
      ghost = false,
      fullscreenGhost = false,
      accentColor,
      accentSide = "left",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isControlled = fullscreen !== undefined;
    const [internalFullscreen, setInternalFullscreen] = React.useState(false);
    const isFullscreen = isControlled ? fullscreen : internalFullscreen;
    const setFullscreen = React.useCallback(
      (v: boolean) => {
        if (isControlled) onFullscreenChange?.(v);
        else setInternalFullscreen(v);
      },
      [isControlled, onFullscreenChange],
    );
    const toggleFullscreen = React.useCallback(
      () => setFullscreen(!isFullscreen),
      [setFullscreen, isFullscreen],
    );

    // O overlay é `fixed`, mas a página continua em fluxo atrás dele: sem a
    // trava, a barra de rolagem da página segue ativa e rolar não muda nada na
    // tela.
    useBodyScrollLock(isFullscreen);

    React.useEffect(() => {
      if (!isFullscreen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setFullscreen(false);
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isFullscreen, setFullscreen]);

    const accentSideClass: Record<AccentSide, string> = {
      top: "border-t-3",
      right: "border-r-3",
      bottom: "border-b-3",
      left: "border-l-3"};

    const accentStyle: React.CSSProperties = accentColor
      ? {
          [`border${accentSide.charAt(0).toUpperCase() + accentSide.slice(1)}Color`]: accentColor}
      : {};

    const baseClass = ghost && (!isFullscreen || fullscreenGhost)
      ? "relative w-full"
      : cn(
          "relative w-full rounded-lg border border-border bg-card p-6 text-left shadow-xs",
          accentColor && accentSideClass[accentSide],
        );

    if (asChild) {
      return (
        <Slot.Root
          ref={ref}
          className={cn(
            baseClass,
            !ghost && hoverShadow && "transition-all duration-200 ease-in-out hover:border-foreground/20 hover:shadow-sm",
            className,
          )}
          style={{ ...accentStyle, ...props.style }}
          {...props}
        >
          {children}
        </Slot.Root>
      );
    }

    const fullscreenButton = enableFullscreen && (!isControlled || isFullscreen) && (
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        className={cn(
          "flex size-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground",
          ghost ? "bg-muted text-foreground" : "absolute top-3 right-3 text-muted-foreground",
        )}
      >
        {isFullscreen ? (
          <Minimize2 className="size-3.5" aria-hidden="true" />
        ) : (
          <Maximize2 className="size-3.5" aria-hidden="true" />
        )}
      </button>
    );
    const customFullscreenTrigger = enableFullscreen && fullscreenTrigger && !isFullscreen && (
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label="Fullscreen"
        className="block w-full rounded-md text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {fullscreenTrigger}
      </button>
    );

    const cardContent = (
      <div
        ref={ref}
        data-fullscreen={isFullscreen ? "" : undefined}
        className={cn(
          baseClass,
          isFullscreen
            ? "flex h-full min-h-0 flex-col overflow-hidden"
            : [
                !ghost && hoverShadow && "transition-all duration-200 ease-in-out hover:border-foreground/20 hover:shadow-sm",
                className,
              ],
        )}
        style={{ ...accentStyle, ...props.style }}
        {...props}
      >
        {ghost && enableFullscreen ? (
          <>
            {customFullscreenTrigger ??
              (!isFullscreen && fullscreenButton ? (
                <div className="mb-4 flex justify-end">{fullscreenButton}</div>
              ) : null)}
            {isFullscreen && fullscreenButton ? (
              <div className="absolute top-3 right-3 z-10">{fullscreenButton}</div>
            ) : null}
            {customFullscreenTrigger ? null : children}
            {isFullscreen && fullscreenChildren ? (
              <div className={cn("min-h-0 flex-1 overflow-y-auto", fullscreenExclusive ? "mt-0" : "mt-4")}>
                {fullscreenExclusive ? fullscreenChildren : (
                  <>
                    {children}
                    {fullscreenChildren}
                  </>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {fullscreenButton}
            {isFullscreen ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                {fullscreenExclusive && fullscreenChildren != null
                  ? fullscreenChildren
                  : (
                      <>
                        {children}
                        {fullscreenChildren}
                      </>
                    )}
              </div>
            ) : (
              children
            )}
          </>
        )}
      </div>
    );

    // O provider envolve as DUAS saídas para o conteúdo sempre enxergar o
    // estado — inclusive na visão normal, onde ele é `false`.
    if (isFullscreen) {
      return ReactDOM.createPortal(
        <CardFullscreenContext.Provider value={true}>
          <div
            className={cn(
              "fixed inset-0 z-50 flex min-h-0 flex-col bg-background animate-in fade-in-0 zoom-in-95 duration-200",
              // `fullscreenGhost` = conteúdo ocupa toda a área: sem padding do
              // overlay, deixando o próprio conteúdo definir o respiro interno.
              fullscreenGhost ? "p-0" : "p-4 sm:p-6",
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col">{cardContent}</div>
          </div>
        </CardFullscreenContext.Provider>,
        document.body,
      );
    }

    return (
      <CardFullscreenContext.Provider value={false}>{cardContent}</CardFullscreenContext.Provider>
    );
  },
);

Card.displayName = "Card";

export { Card };
