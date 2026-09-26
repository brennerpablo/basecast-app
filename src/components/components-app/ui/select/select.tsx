"use client"

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HistoryIcon,
  PlusIcon,
  SearchIcon,
  XIcon
} from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

// --- i18n ---

type SelectLanguage = "en" | "pt"

const translations = {
  en: { search: "Search...", lastSelected: "Last:", create: "New item" },
  pt: { search: "Buscar...", lastSelected: "Último:", create: "Novo item" }} as const

const LanguageContext = React.createContext<SelectLanguage>("en")

const SearchContext = React.createContext<{
  search: string
  setSearch: React.Dispatch<React.SetStateAction<string>>
}>({ search: "", setSearch: () => {} })

// --- Last-selected cookie helpers ---

const COOKIE_PREFIX = "select-last:"

function getLastSelected(selectId: string): { value: string; label: string } | null {
  if (typeof document === "undefined") return null
  const name = `${COOKIE_PREFIX}${selectId}=`
  const match = document.cookie.split("; ").find((c) => c.startsWith(name))
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match.slice(name.length)))
  } catch {
    return null
  }
}

function setLastSelected(selectId: string, value: string, label: string) {
  const payload = encodeURIComponent(JSON.stringify({ value, label }))
  // 90-day expiry
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${COOKIE_PREFIX}${selectId}=${payload}; path=/; expires=${expires}; SameSite=Lax`
}

// --- Clearable context ---

const ClearableContext = React.createContext<{
  clearable: boolean
  hasValue: boolean
  onClear: () => void
}>({ clearable: false, hasValue: false, onClear: () => {} })

// --- Close-select context ---
//
// Lets inner components (e.g. the create button in SelectContent) close the
// dropdown programmatically. Provided by the root <Select> so it can hook into
// the existing open-state machinery without exposing it as a prop.

const CloseSelectContext = React.createContext<() => void>(() => {})

// --- Render-item context ---

type RenderItemFn = (entry: { value: string; label: string }) => React.ReactNode

const RenderItemContext = React.createContext<RenderItemFn | undefined>(undefined)

// --- Last-selected context ---

type LastSelectedEntry = { value: string; label: string }

type LastSelectedContextValue = {
  selectId: string | null
  enabled: boolean
  lastSelected: LastSelectedEntry | null
  renderLastSelected?: (entry: LastSelectedEntry) => React.ReactNode
  registerItem: (value: string, label: string) => void
  onSelect: (value: string) => void
}

const LastSelectedContext = React.createContext<LastSelectedContextValue>({
  selectId: null,
  enabled: false,
  lastSelected: null,
  renderLastSelected: undefined,
  registerItem: () => {},
  onSelect: () => {}})

/**
 * A regra de controle do Select, isolada para ser testavel sem montar o Radix.
 *
 * Quem decide e a PRESENCA da prop `value`, nao o que ela carrega: o consumidor
 * que escreve `value={x || undefined}` e dono do valor mesmo quando o passa
 * vazio (que e como se escreve "vazio" para o Radix). Sem isso o componente cai
 * para o valor interno e mostra a escolha anterior (26/08/2026).
 */
export function selectControlledValue(
  passesValue: boolean,
  valueProp: string | undefined,
  internalValue: string,
): { isControlled: boolean; value: string } {
  // A regra de 26/08 aproximava a presenca pelo `defaultValue`
  // (`valueProp !== undefined || defaultValue === undefined`), e o idioma
  // `defaultValue={field.value ?? undefined}` a derrubava: o campo abria vazio
  // e "controlado", o primeiro clique enchia o `defaultValue`, o componente
  // virava NAO-CONTROLADO com o valor interno ainda vazio — e o gatilho seguia
  // em "Selecione" com o formulario ja preenchido. Dois cliques (24/09/2026).
  return { isControlled: passesValue, value: passesValue ? (valueProp ?? "") : internalValue }
}

type SelectProps = React.ComponentProps<typeof SelectPrimitive.Root> & {
  selectId?: string
  enableLastSelected?: boolean
  renderLastSelected?: (entry: LastSelectedEntry) => React.ReactNode
  renderItem?: RenderItemFn
  language?: SelectLanguage
  clearable?: boolean
  /** Value passed to onValueChange when cleared. Defaults to null. */
  clearedValue?: unknown
}

// --- Components ---

function Select(selectProps: SelectProps) {
  const {
    selectId,
    enableLastSelected = false,
    renderLastSelected,
    renderItem,
    language = "en",
    clearable = false,
    clearedValue = null,
    onValueChange,
    value: valueProp,
    defaultValue,
    open: openProp,
    onOpenChange,
    ...props
  } = selectProps
  const enabled = enableLastSelected && !!selectId
  const [lastSelected, setLastSelectedState] = React.useState<{ value: string; label: string } | null>(null)
  const itemMapRef = React.useRef<Map<string, string>>(new Map())
  const [search, setSearch] = React.useState("")

  // When last-selected or clearable is enabled, we need internal control over value & open
  // so the footer button / clear button can programmatically set the value
  //
  // CONTROLE PEGAJOSO. Quem consome escreve `value={x || undefined}` — o idioma
  // que o Radix pede, porque ele nao aceita `value=""`. Com a regra ingenua
  // (`valueProp !== undefined`), o componente voltava a ser NAO-CONTROLADO assim
  // que o valor esvaziava, e passava a mostrar o `internalValue` — a ultima
  // escolha guardada dentro dele. O trigger exibia um fundo que o estado da
  // pagina ja nao tinha, e nenhuma limpeza do lado do consumidor o apagava.
  //
  // Quem passa `value` CONTROLA — e `undefined` ai significa vazio, nao "assuma
  // por mim". Quem passa so `defaultValue` e dono do valor do comeco ao fim.
  // JSX `value={undefined}` poe a chave no objeto de props, entao os dois casos
  // continuam distinguiveis.
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const [internalOpen, setInternalOpen] = React.useState(false)

  const { isControlled, value: currentValue } = selectControlledValue(
    "value" in selectProps,
    valueProp,
    internalValue,
  )
  const currentOpen = openProp ?? internalOpen

  React.useEffect(() => {
    if (enabled) {
      setLastSelectedState(getLastSelected(selectId!))
    }
  }, [enabled, selectId])

  const registerItem = React.useCallback((value: string, label: string) => {
    itemMapRef.current.set(value, label)
  }, [])

  const handleValueChange = React.useCallback(
    (value: string) => {
      if (!isControlled) setInternalValue(value)
      if (enabled) {
        const label = itemMapRef.current.get(value) ?? value
        setLastSelected(selectId!, value, label)
        setLastSelectedState({ value, label })
      }
      onValueChange?.(value)
    },
    [enabled, isControlled, selectId, onValueChange]
  )

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) setSearch("")
      setInternalOpen(open)
      onOpenChange?.(open)
    },
    [onOpenChange]
  )

  const handleLastSelectedPick = React.useCallback(
    (value: string) => {
      handleValueChange(value)
      handleOpenChange(false)
    },
    [handleValueChange, handleOpenChange]
  )

  const ctx = React.useMemo<LastSelectedContextValue>(
    () => ({
      selectId: selectId ?? null,
      enabled,
      lastSelected,
      renderLastSelected,
      registerItem,
      onSelect: handleLastSelectedPick}),
    [selectId, enabled, lastSelected, renderLastSelected, registerItem, handleLastSelectedPick]
  )

  // When last-selected or clearable is enabled, always use controlled mode so we can set value programmatically
  const needsControl = enabled || clearable
  const rootProps = needsControl
    ? { value: currentValue, onValueChange: handleValueChange, open: currentOpen, onOpenChange: handleOpenChange }
    : { value: valueProp, defaultValue, onValueChange: handleValueChange, open: openProp, onOpenChange: handleOpenChange }

  const searchCtx = React.useMemo(() => ({ search, setSearch }), [search])

  // Clearable: use key to force Radix to remount when value is cleared (Radix doesn't support value="")
  const [clearKey, setClearKey] = React.useState(0)

  /**
   * A MESMA necessidade do `clearable`, agora para o valor que vem de fora.
   *
   * O Radix nao volta ao placeholder recebendo `value=""` — precisa remontar.
   * O `clearable` ja resolvia isso para a limpeza feita pelo proprio botao;
   * com o controle pegajoso o valor tambem pode esvaziar porque o CONSUMIDOR o
   * esvaziou, e sem remontar o trigger ficaria com o rotulo antigo na tela.
   *
   * A chave alterna entre dois valores (cheio/vazio), entao so remonta na
   * TRANSICAO — trocar de um fundo para outro nao remonta nada.
   */
  const vazioKey = needsControl && isControlled && !currentValue ? "vazio" : "cheio"

  const handleClear = React.useCallback(() => {
    if (!isControlled) setInternalValue("")
    setClearKey((k) => k + 1)
     
    onValueChange?.(clearedValue as any)
  }, [isControlled, onValueChange, clearedValue])

  const clearableCtx = React.useMemo(
    () => ({ clearable, hasValue: !!currentValue, onClear: handleClear }),
    [clearable, currentValue, handleClear]
  )

  return (
    <LanguageContext.Provider value={language}>
      <SearchContext.Provider value={searchCtx}>
        <RenderItemContext.Provider value={renderItem}>
          <LastSelectedContext.Provider value={ctx}>
            <ClearableContext.Provider value={clearableCtx}>
              <CloseSelectContext.Provider value={() => handleOpenChange(false)}>
                <SelectPrimitive.Root key={clearable ? clearKey : vazioKey} data-slot="select" {...rootProps} {...props} />
              </CloseSelectContext.Provider>
            </ClearableContext.Provider>
          </LastSelectedContext.Provider>
        </RenderItemContext.Provider>
      </SearchContext.Provider>
    </LanguageContext.Provider>
  )
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  shadow = "xs",
  loading = false,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
  shadow?: "none" | "xs" | "sm"
  loading?: boolean
}) {
  const { clearable, hasValue, onClear } = React.useContext(ClearableContext)

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      disabled={loading || props.disabled}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:max-w-full *:data-[slot=select-value]:truncate *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40",
        shadow === "xs" && "shadow-xs",
        shadow === "sm" && "shadow-sm",
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-24 animate-pulse rounded bg-muted" />
      ) : children}
      {clearable && hasValue ? (
        <span
          role="button"
          aria-label="Clear selection"
          className="pointer-events-auto rounded-sm opacity-50 hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onClear()
          }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <XIcon className="size-3.5" />
        </span>
      ) : (
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 opacity-50" />
        </SelectPrimitive.Icon>
      )}
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position: positionProp,
  align = "center",
  searchable = false,
  searchPlaceholder,
  onCreate,
  createLabel,
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Content>, "align"> & {
  /**
   * Horizontal alignment of the dropdown relative to the trigger.
   * Wraps Radix's `align` (`start | center | end`) with the more intuitive
   * `left | center | right` names. LTR-only — these don't flip in RTL.
   */
  align?: "left" | "center" | "right"
  searchable?: boolean
  searchPlaceholder?: string
  /**
   * v1 of in-dropdown create. When provided, renders a sticky button at the
   * top of the dropdown that closes the Select and invokes this callback —
   * the parent typically opens its own create dialog and, on success, sets
   * the new value via the controlled `value` prop.
   */
  onCreate?: () => void
  createLabel?: string
}) {
  const lang = React.useContext(LanguageContext)
  const resolvedSearchPlaceholder = searchPlaceholder ?? translations[lang].search
  const resolvedCreateLabel = createLabel ?? translations[lang].create
  const { search, setSearch } = React.useContext(SearchContext)
  const closeSelect = React.useContext(CloseSelectContext)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const radixAlign = align === "left" ? "start" : align === "right" ? "end" : "center"

  // Default to popper positioning. Radix's item-aligned mode has a long-standing
  // bug where a list taller than the viewport gets stuck at the bottom and can't
  // scroll back up; popper uses a normal overflow container instead. searchable /
  // onCreate also require popper for their sticky header. Callers can still opt
  // into "item-aligned" explicitly (ignored when a sticky header is present).
  const position = searchable || onCreate ? "popper" : (positionProp ?? "popper")

  return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          className={cn(
            "relative z-50 max-h-(--radix-select-content-available-height) min-w-32 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            position === "popper" &&
              "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
            // A lista nunca fica mais larga que o próprio gatilho: um nome longo
            // (emissores, fundos) esticava o popover muito além do campo e ele
            // passava por cima do resto do formulário. O `min-w-32` acima segue
            // valendo como piso — em CSS `min-width` vence `max-width` —, então
            // um select estreito ainda abre num tamanho utilizável.
            position === "popper" && "max-w-(--radix-select-trigger-width)",
            className
          )}
          position={position}
          align={radixAlign}
          {...props}
        >
          {(searchable || onCreate) && (
            <div className="sticky top-0 z-10 bg-popover border-b">
              {onCreate && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    closeSelect()
                    onCreate()
                  }}
                >
                  <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{resolvedCreateLabel}</span>
                </button>
              )}
              {searchable && (
                <div className={cn("p-1.5", onCreate && "border-t")}>
                  <div className="flex items-center gap-2 px-2">
                    <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <input
                      ref={(node) => {
                        inputRef.current = node
                        if (node) {
                          requestAnimationFrame(() => node.focus())
                        }
                      }}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={resolvedSearchPlaceholder}
                      className="h-7 w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
                      // Prevent Radix from capturing these keys so the input works normally
                      onKeyDown={(e) => {
                        e.stopPropagation()
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {!searchable && !onCreate && <SelectScrollUpButton />}
          <SelectPrimitive.Viewport
            className={cn(
              "p-1",
              position === "popper" &&
                "max-h-[min(var(--radix-select-content-available-height,300px),300px)] w-full min-w-(--radix-select-trigger-width) scroll-my-1"
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          {!searchable && !onCreate && <SelectScrollDownButton />}
          <LastSelectedFooter />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
  )
}

function LastSelectedFooter() {
  const { enabled, lastSelected, renderLastSelected, onSelect } = React.useContext(LastSelectedContext)
  const lang = React.useContext(LanguageContext)

  if (!enabled || !lastSelected) return null

  const custom = renderLastSelected?.(lastSelected)

  return (
    <div className="sticky bottom-0 z-10 border-t bg-popover px-2 py-1.5">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => onSelect(lastSelected.value)}
      >
        {custom ?? (
          <>
            <HistoryIcon className="size-3 shrink-0" />
            <span className="truncate">
              {translations[lang].lastSelected} <span className="font-medium text-foreground">{lastSelected.label}</span>
            </span>
          </>
        )}
      </button>
    </div>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  searchValue,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  searchValue?: string
}) {
  const { search } = React.useContext(SearchContext)
  const { registerItem } = React.useContext(LastSelectedContext)
  const renderItem = React.useContext(RenderItemContext)

  // Register this item's value → label mapping for the last-selected feature
  const label =
    typeof children === "string"
      ? children
      : (searchValue ?? props.value ?? "")
  React.useEffect(() => {
    registerItem(props.value, label)
  }, [props.value, label, registerItem])

  if (search) {
    const text = (searchValue ?? label).toLowerCase()
    if (!text.includes(search.toLowerCase())) {
      return null
    }
  }

  const customContent = renderItem?.({ value: props.value, label })

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        // `min-w-0` + `overflow-hidden` (aqui e no span do rótulo) são o que
        // permite o item encolher dentro da largura do gatilho em vez de
        // empurrar o popover.
        "relative flex w-full min-w-0 cursor-default items-center gap-2 overflow-hidden rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:min-w-0 *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      {customContent ? (
        <>
          <span aria-hidden="true">{customContent}</span>
          <SelectPrimitive.ItemText className="hidden">{children}</SelectPrimitive.ItemText>
        </>
      ) : (
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      )}
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export type { LastSelectedEntry, RenderItemFn, SelectLanguage }

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue}
