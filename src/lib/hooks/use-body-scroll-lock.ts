"use client";

import * as React from "react";

/**
 * Trava a rolagem da página enquanto um overlay `position: fixed` está aberto.
 *
 * Sem isto a barra de rolagem da página continua ativa ATRÁS do overlay: ela
 * anda, o conteúdo por baixo rola e a tela não muda nada — uma rolagem que não
 * faz nada. Os diálogos do Radix já fazem essa trava sozinhos; os modos de tela
 * cheia do Card e da DataTable são portais escritos à mão e precisam do
 * equivalente.
 *
 * O contador é de módulo porque as travas se aninham (um Card em tela cheia que
 * contém uma DataTable que também abre em tela cheia): só a primeira aquisição
 * mexe no `<body>` e só a última liberação o restaura.
 */
let lockCount = 0;
let restoreBodyStyle: (() => void) | null = null;

function acquireLock() {
  lockCount += 1;
  if (lockCount > 1) return;

  const { body } = document;
  const previousOverflow = body.style.overflow;
  const previousPaddingRight = body.style.paddingRight;

  // Barra clássica (Windows/Linux) ocupa layout: ao sumir com a trava, o
  // conteúdo pularia para a direita. Compensamos com o padding equivalente.
  // Barra sobreposta (macOS) mede 0 e nada é compensado.
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbarWidth > 0) {
    const currentPadding =
      Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
  }
  body.style.overflow = "hidden";

  restoreBodyStyle = () => {
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPaddingRight;
  };
}

function releaseLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && restoreBodyStyle) {
    restoreBodyStyle();
    restoreBodyStyle = null;
  }
}

export function useBodyScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    acquireLock();
    return releaseLock;
  }, [active]);
}
