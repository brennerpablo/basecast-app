"use client"

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
  draggable,
  dropTargetForElements,
  monitorForElements} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder"
import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash"
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index"
import * as liveRegion from "@atlaskit/pragmatic-drag-and-drop-live-region"
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box"
import { Column, Table } from "@tanstack/react-table"
import {
  GripVertical,
  SlidersHorizontal
} from "lucide-react"
import React from "react"
import ReactDOM from "react-dom"
import invariant from "tiny-invariant"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { useDataTableLocale } from "./DataTableLocaleContext"

const COOKIE_KEY = "data-table-column-order"

function getCookieColumnOrder(): string[] | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`),
  )
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

function setCookieColumnOrder(order: string[]) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(order))}; expires=${expires.toUTCString()}; path=/`
}

type CleanupFn = () => void

type ItemEntry = { itemId: string; element: HTMLElement }

type ListContextValue = {
  getListLength: () => number
  registerItem: (entry: ItemEntry) => CleanupFn
  reorderItem: (args: {
    startIndex: number
    indexOfTarget: number
    closestEdgeOfTarget: Edge | null
  }) => void
  instanceId: symbol
}

const ListContext = React.createContext<ListContextValue | null>(null)

function useListContext() {
  const listContext = React.useContext(ListContext)
  invariant(listContext !== null)
  return listContext
}

type Item = {
  id: string
  label: string
}

const itemKey = Symbol("item")

type ItemData = {
  [itemKey]: true
  item: Item
  index: number
  instanceId: symbol
}

function getItemData({
  item,
  index,
  instanceId}: {
  item: Item
  index: number
  instanceId: symbol
}): ItemData {
  return {
    [itemKey]: true,
    item,
    index,
    instanceId}
}

function isItemData(data: Record<string | symbol, unknown>): data is ItemData {
  return data[itemKey] === true
}

type DraggableState =
  | { type: "idle" }
  | { type: "preview"; container: HTMLElement }
  | { type: "dragging" }

const idleState: DraggableState = { type: "idle" }
const draggingState: DraggableState = { type: "dragging" }

function ListItem({
  item,
  index,
  column}: {
  item: Item
  index: number
  column: Column<unknown, unknown> | undefined
}) {
  const { registerItem, instanceId } = useListContext()
  const locale = useDataTableLocale()

  const ref = React.useRef<HTMLDivElement>(null)
  const [closestEdge, setClosestEdge] = React.useState<Edge | null>(null)

  const dragHandleRef = React.useRef<HTMLButtonElement>(null)

  const [draggableState, setDraggableState] =
    React.useState<DraggableState>(idleState)

  React.useEffect(() => {
    const element = ref.current
    const dragHandle = dragHandleRef.current
    invariant(element)
    invariant(dragHandle)

    const data = getItemData({ item, index, instanceId })

    return combine(
      registerItem({ itemId: item.id, element }),
      draggable({
        element: dragHandle,
        getInitialData: () => data,
        onGenerateDragPreview({ nativeSetDragImage }) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({
              x: "10px",
              y: "10px"}),
            render({ container }) {
              setDraggableState({ type: "preview", container })

              return () => setDraggableState(draggingState)
            }})
        },
        onDragStart() {
          setDraggableState(draggingState)
        },
        onDrop() {
          setDraggableState(idleState)
        }}),
      dropTargetForElements({
        element,
        canDrop({ source }) {
          return (
            isItemData(source.data) && source.data.instanceId === instanceId
          )
        },
        getData({ input }) {
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"]})
        },
        onDrag({ self, source }) {
          const isSource = source.element === element
          if (isSource) {
            setClosestEdge(null)
            return
          }

          const closestEdge = extractClosestEdge(self.data)

          const sourceIndex = source.data.index
          invariant(typeof sourceIndex === "number")

          const isItemBeforeSource = index === sourceIndex - 1
          const isItemAfterSource = index === sourceIndex + 1

          const isDropIndicatorHidden =
            (isItemBeforeSource && closestEdge === "bottom") ||
            (isItemAfterSource && closestEdge === "top")

          if (isDropIndicatorHidden) {
            setClosestEdge(null)
            return
          }

          setClosestEdge(closestEdge)
        },
        onDragLeave() {
          setClosestEdge(null)
        },
        onDrop() {
          setClosestEdge(null)
        }}),
    )
  }, [instanceId, item, index, registerItem])

  return (
    <React.Fragment>
      <div ref={ref} className="relative border-b border-transparent">
        <div
          className={cn(
            "relative flex items-center justify-between gap-2",
            draggableState.type === "dragging" && "opacity-50",
          )}
        >
          <div className="flex items-center gap-2">
            <Checkbox
              checked={column?.getIsVisible()}
              onCheckedChange={() => column?.toggleVisibility()}
            />
            <span className="text-sm">{item.label}</span>
          </div>
          <Button
            aria-hidden="true"
            tabIndex={-1}
            variant="ghost"
            className="-mr-1 cursor-grab px-0 py-1 active:cursor-grabbing"
            ref={dragHandleRef}
            aria-label={locale.reorderColumn(item.label)}
          >
            <GripVertical className="size-5 text-muted-foreground" />
          </Button>
        </div>
        {closestEdge && <DropIndicator edge={closestEdge} gap="1px" />}
      </div>
      {draggableState.type === "preview" &&
        ReactDOM.createPortal(
          <div className="rounded-md border bg-popover px-2 py-1 text-sm shadow-md">
            {item.label}
          </div>,
          draggableState.container,
        )}
    </React.Fragment>
  )
}

function getItemRegistry() {
  const registry = new Map<string, HTMLElement>()

  function register({ itemId, element }: ItemEntry) {
    registry.set(itemId, element)

    return function unregister() {
      registry.delete(itemId)
    }
  }

  function getElement(itemId: string): HTMLElement | null {
    return registry.get(itemId) ?? null
  }

  return { register, getElement }
}

type ListState = {
  items: Item[]
  lastCardMoved: {
    item: Item
    previousIndex: number
    currentIndex: number
    numberOfItems: number
  } | null
}

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
  persistColumnOrder?: boolean
  /**
   * A ordem das colunas É DADO, não preferência.
   *
   * Numa matriz cujas colunas são uma sequência — datas, períodos —, reordenar
   * não é gosto do usuário: 28/05 vem antes de 23/08 porque o calendário diz.
   * Com isto ligado, a lista segue sempre a ordem dos metadados.
   *
   * Sem isto, a preservação abaixo (mantém as que sobraram, acrescenta as novas
   * no fim) reordena a matriz ao trocar de janela: as poucas datas que existiam
   * nas duas janelas ficam na frente e todo o resto vai para trás.
   */
  columnOrderFollowsData?: boolean
  iconsOnly?: boolean
}

function ViewOptions<TData>({
  table,
  persistColumnOrder = false,
  columnOrderFollowsData = false,
  iconsOnly = false}: DataTableViewOptionsProps<TData>) {
  const locale = useDataTableLocale()
  const tableColumns: Item[] = table.getAllColumns().map((column) => ({
    id: column.id,
    label: column.columnDef.meta?.displayName as string}))
  const [{ items, lastCardMoved }, setListState] = React.useState<ListState>(
    () => {
      let initialItems = tableColumns
      if (persistColumnOrder && !columnOrderFollowsData) {
        const saved = getCookieColumnOrder()
        if (saved) {
          const savedItems = saved
            .flatMap((id) => tableColumns.some((col) => col.id === id) ? [tableColumns.find((col) => col.id === id)!] : [])
          const newColumns = tableColumns.filter(
            (col) => !saved.includes(col.id),
          )
          initialItems = [...savedItems, ...newColumns]
        }
      }
      return { items: initialItems, lastCardMoved: null }
    },
  )
  const [registry] = React.useState(getItemRegistry)

  const [instanceId] = React.useState(() => Symbol("instance-id"))

  // `items` nasce do estado inicial e não acompanhava a tabela. Quando o
  // conjunto de colunas muda sem desmontar (matriz por data trocando de fundo,
  // de período ou de janela), a lista fica apontando para ids que já não
  // existem: `table.getColumn(id)` devolve undefined e o tanstack loga
  // "Column with id 'X' does not exist" — e o `setColumnOrder` abaixo ainda
  // ordenava por eles. A ordem escolhida pelo usuário sobrevive; some quem
  // saiu, entra no fim quem chegou.
  const columnIdsKey = tableColumns.map((column) => column.id).join("|")
  React.useEffect(() => {
    setListState((state) => {
      // Ordem é dado: o conjunto novo manda, inteiro e na ordem dele.
      if (columnOrderFollowsData) {
        const igual =
          state.items.length === tableColumns.length &&
          state.items.every((item, i) => item.id === tableColumns[i]?.id)
        return igual ? state : { ...state, items: tableColumns }
      }
      const byId = new Map(tableColumns.map((column) => [column.id, column]))
      const kept = state.items.flatMap((item) =>
        byId.has(item.id) ? [byId.get(item.id)!] : [],
      )
      const added = tableColumns.filter(
        (column) => !state.items.some((item) => item.id === column.id),
      )
      if (kept.length === state.items.length && added.length === 0) {
        return state
      }
      return { ...state, items: [...kept, ...added] }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnIdsKey])

  React.useEffect(() => {
    table.setColumnOrder(items.map((item) => item.id))
    if (persistColumnOrder) {
      setCookieColumnOrder(items.map((item) => item.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const reorderItem = React.useCallback(
    ({
      startIndex,
      indexOfTarget,
      closestEdgeOfTarget}: {
      startIndex: number
      indexOfTarget: number
      closestEdgeOfTarget: Edge | null
    }) => {
      const finishIndex = getReorderDestinationIndex({
        startIndex,
        closestEdgeOfTarget,
        indexOfTarget,
        axis: "vertical"})

      if (finishIndex === startIndex) {
        return
      }

      setListState((listState) => {
        const item = listState.items[startIndex]

        return {
          items: reorder({
            list: listState.items,
            startIndex,
            finishIndex}),
          lastCardMoved: {
            item,
            previousIndex: startIndex,
            currentIndex: finishIndex,
            numberOfItems: listState.items.length}}
      })
    },
    [],
  )

  React.useEffect(() => {
    return monitorForElements({
      canMonitor({ source }) {
        return isItemData(source.data) && source.data.instanceId === instanceId
      },
      onDrop({ location, source }) {
        const target = location.current.dropTargets[0]
        if (!target) {
          return
        }

        const sourceData = source.data
        const targetData = target.data
        if (!isItemData(sourceData) || !isItemData(targetData)) {
          return
        }

        const indexOfTarget = items.findIndex(
          (item) => item.id === targetData.item.id,
        )
        if (indexOfTarget < 0) {
          return
        }

        const closestEdgeOfTarget = extractClosestEdge(targetData)

        reorderItem({
          startIndex: sourceData.index,
          indexOfTarget,
          closestEdgeOfTarget})
      }})
  }, [instanceId, items, reorderItem])

  React.useEffect(() => {
    if (lastCardMoved === null) {
      return
    }

    const { item, previousIndex, currentIndex, numberOfItems } = lastCardMoved
    const element = registry.getElement(item.id)
    if (element) {
      triggerPostMoveFlash(element)
    }

    liveRegion.announce(
      locale.movedColumn({ label: item.label, previousIndex, currentIndex, numberOfItems }),
    )
  }, [lastCardMoved, registry, locale])

  React.useEffect(() => {
    return function cleanup() {
      liveRegion.cleanup()
    }
  }, [])

  const getListLength = React.useCallback(() => items.length, [items.length])

  const contextValue: ListContextValue = React.useMemo(() => {
    return {
      registerItem: registry.register,
      reorderItem,
      instanceId,
      getListLength}
  }, [registry.register, reorderItem, instanceId, getListLength])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden gap-x-2 px-2 py-1.5 text-sm sm:text-xs lg:flex"
          aria-label={locale.view}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {!iconsOnly && locale.view}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={7}
        className="z-50 w-fit space-y-2"
      >
        <Label className="font-medium">{locale.displayProperties}</Label>
        <ListContext.Provider value={contextValue}>
          <div className="flex flex-col">
            {items.map((item, index) => {
              const column = table.getColumn(item.id)
              if (!column) return null
              return (
                <div
                  key={column.id}
                  className={cn(!column.getCanHide() && "hidden")}
                >
                  <ListItem column={column as Column<unknown, unknown>} item={item} index={index} />
                </div>
              )
            })}
          </div>
        </ListContext.Provider>
      </PopoverContent>
    </Popover>
  )
}

export { ViewOptions }
