// AreaChart — adapted from Tremor AreaChart v1.0.0

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Dot,
  Label,
  LabelList,
  Legend as RechartsLegend,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AxisDomain } from "recharts/types/util/types";

import { cn } from "@/lib/utils";

import {
  CHART_COLORS,
  type ChartColor,
  chartColorToCss,
  constructCategoryColors,
  getColorClass,
  isHexColor,
} from "../utils/chartColors";
import {
  type CompactScale,
  computeNiceTicks,
  computeYDomainWithPadding,
  detectCompactScale,
  formatCompactNumber,
  getYAxisDomain,
  hasOnlyOneValueForKey,
  inferYAxisWidth,
  measureTextWidth,
  onlyOneValueByKey,
} from "../utils/chartHelpers";
import { MeasuredResponsiveContainer } from "../utils/MeasuredResponsiveContainer";

/**
 * Tinta do rótulo de eixo. Vai no objeto `tick`, NUNCA no `className` do eixo.
 *
 * O recharts 3 desenha os rótulos numa subárvore própria
 * (`recharts-cartesian-axis-tick-labels`, dentro de um `recharts-zIndex-layer`)
 * que NÃO é descendente do `<g>` que recebe o `className` do eixo. Uma classe
 * de `fill` ali pinta um grupo vazio, e o `<text>`, que sai com `fill=""`,
 * herda do `<svg>`: PRETO. Era assim nos dois temas — no claro ninguém
 * reparou, no escuro o eixo sumia. Medido no DOM em 11/09/2026.
 *
 * O caminho que chega ao `<text>` é `tick.className`: o `renderTickItem` do
 * `CartesianAxis` monta o className do zero e só acrescenta o que
 * `getClassNameFromUnknown` extrai do objeto `tick`.
 */
const AXIS_TICK_CLASS = "fill-gray-500 dark:fill-gray-300";
import { useOnWindowResize } from "../utils/useOnWindowResize";

type ChartTextSize = "xs" | "sm" | "md" | "lg" | number;

function resolveTextSize(size: ChartTextSize): number {
  if (typeof size === "number") return size;
  return { xs: 12, sm: 14, md: 16, lg: 18 }[size];
}

//#region Legend

interface LegendItemProps {
  name: string;
  color: ChartColor | string;
  onClick?: (name: string, color: ChartColor | string) => void;
  activeLegend?: string;
  textSize?: number;
}

const LegendItem = ({
  name,
  color,
  onClick,
  activeLegend,
  textSize,
}: LegendItemProps) => {
  const hasOnValueChange = !!onClick;
  return (
    <li
      className={cn(
        // base
        "group inline-flex flex-nowrap items-center gap-1.5 rounded-sm px-2 py-1 whitespace-nowrap transition",
        hasOnValueChange
          ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
          : "cursor-default",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(name, color);
      }}
    >
      <span
        className={cn(
          "h-0.75 w-3.5 shrink-0 rounded-full",
          isHexColor(color as string)
            ? undefined
            : getColorClass(color as ChartColor, "bg"),
          activeLegend && activeLegend !== name ? "opacity-40" : "opacity-100",
        )}
        style={
          isHexColor(color as string)
            ? { backgroundColor: color as string }
            : undefined
        }
        aria-hidden={true}
      />
      <p
        className={cn(
          // base
          "truncate whitespace-nowrap",
          // text color
          "text-gray-700 dark:text-gray-300",
          hasOnValueChange &&
            "group-hover:text-gray-900 dark:group-hover:text-gray-50",
          activeLegend && activeLegend !== name ? "opacity-40" : "opacity-100",
        )}
        style={{ fontSize: textSize }}
      >
        {name}
      </p>
    </li>
  );
};

interface ScrollButtonProps {
  icon: React.ElementType;
  onClick?: () => void;
  disabled?: boolean;
}

const ScrollButton = ({ icon, onClick, disabled }: ScrollButtonProps) => {
  const Icon = icon;
  const [isPressed, setIsPressed] = React.useState(false);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (isPressed) {
      intervalRef.current = setInterval(() => {
        onClick?.();
      }, 300);
    } else {
      clearInterval(intervalRef.current as NodeJS.Timeout);
    }
    return () => clearInterval(intervalRef.current as NodeJS.Timeout);
  }, [isPressed, onClick]);

  React.useEffect(() => {
    if (disabled) {
      clearInterval(intervalRef.current as NodeJS.Timeout);
      setIsPressed(false);
    }
  }, [disabled]);

  return (
    <button
      type="button"
      className={cn(
        // base
        "group inline-flex size-5 items-center truncate rounded-sm transition",
        disabled
          ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
          : "cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-50",
      )}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setIsPressed(true);
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
        setIsPressed(false);
      }}
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
};

interface LegendProps extends React.OlHTMLAttributes<HTMLOListElement> {
  categories: string[];
  colors?: readonly (ChartColor | string)[];
  onClickLegendItem?: (category: string, color: string) => void;
  activeLegend?: string;
  enableLegendSlider?: boolean;
  textSize?: number;
}

type HasScrollProps = {
  left: boolean;
  right: boolean;
};

const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
  const {
    categories,
    colors = CHART_COLORS,
    className,
    onClickLegendItem,
    activeLegend,
    enableLegendSlider = false,
    textSize,
    ...other
  } = props;
  const scrollableRef = React.useRef<HTMLInputElement>(null);
  const scrollButtonsRef = React.useRef<HTMLDivElement>(null);
  const [hasScroll, setHasScroll] = React.useState<HasScrollProps | null>(null);
  const [isKeyDowned, setIsKeyDowned] = React.useState<string | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const checkScroll = React.useCallback(() => {
    const scrollable = scrollableRef?.current;
    if (!scrollable) return;

    const hasLeftScroll = scrollable.scrollLeft > 0;
    const hasRightScroll =
      scrollable.scrollWidth - scrollable.clientWidth > scrollable.scrollLeft;

    setHasScroll({ left: hasLeftScroll, right: hasRightScroll });
  }, [setHasScroll]);

  const scrollToTest = React.useCallback(
    (direction: "left" | "right") => {
      const element = scrollableRef?.current;
      const scrollButtons = scrollButtonsRef?.current;
      const scrollButtonsWith = scrollButtons?.clientWidth ?? 0;
      const width = element?.clientWidth ?? 0;

      if (element && enableLegendSlider) {
        element.scrollTo({
          left:
            direction === "left"
              ? element.scrollLeft - width + scrollButtonsWith
              : element.scrollLeft + width - scrollButtonsWith,
          behavior: "smooth",
        });
        setTimeout(() => {
          checkScroll();
        }, 400);
      }
    },
    [enableLegendSlider, checkScroll],
  );

  React.useEffect(() => {
    const keyDownHandler = (key: string) => {
      if (key === "ArrowLeft") {
        scrollToTest("left");
      } else if (key === "ArrowRight") {
        scrollToTest("right");
      }
    };
    if (isKeyDowned) {
      keyDownHandler(isKeyDowned);
      intervalRef.current = setInterval(() => {
        keyDownHandler(isKeyDowned);
      }, 300);
    } else {
      clearInterval(intervalRef.current as NodeJS.Timeout);
    }
    return () => clearInterval(intervalRef.current as NodeJS.Timeout);
  }, [isKeyDowned, scrollToTest]);

  const keyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setIsKeyDowned(e.key);
    }
  };
  const keyUp = (e: KeyboardEvent) => {
    e.stopPropagation();
    setIsKeyDowned(null);
  };

  React.useEffect(() => {
    const scrollable = scrollableRef?.current;
    if (enableLegendSlider) {
      checkScroll();
      scrollable?.addEventListener("keydown", keyDown);
      scrollable?.addEventListener("keyup", keyUp);
    }

    return () => {
      scrollable?.removeEventListener("keydown", keyDown);
      scrollable?.removeEventListener("keyup", keyUp);
    };
  }, [checkScroll, enableLegendSlider]);

  return (
    <ol
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...other}
    >
      <div
        ref={scrollableRef}
        tabIndex={0}
        className={cn(
          "flex h-full",
          enableLegendSlider
            ? hasScroll?.right || hasScroll?.left
              ? "snap-mandatory items-center overflow-auto pr-12 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : ""
            : "flex-wrap",
        )}
      >
        {categories.map((category, index) => (
          <LegendItem
            key={`item-${index}`}
            name={category}
            color={colors[index] as ChartColor | string}
            onClick={onClickLegendItem}
            activeLegend={activeLegend}
            textSize={textSize}
          />
        ))}
      </div>
      {enableLegendSlider && (hasScroll?.right || hasScroll?.left) ? (
        <>
          <div
            ref={scrollButtonsRef}
            className={cn(
              // base
              "absolute top-0 right-0 bottom-0 flex h-full items-center justify-center pr-1",
              // background color
              "bg-white dark:bg-gray-950",
            )}
          >
            <ScrollButton
              icon={ChevronLeft}
              onClick={() => {
                setIsKeyDowned(null);
                scrollToTest("left");
              }}
              disabled={!hasScroll?.left}
            />
            <ScrollButton
              icon={ChevronRight}
              onClick={() => {
                setIsKeyDowned(null);
                scrollToTest("right");
              }}
              disabled={!hasScroll?.right}
            />
          </div>
        </>
      ) : null}
    </ol>
  );
});

Legend.displayName = "Legend";

const ChartLegend = (
  { payload }: any,
  categoryColors: Map<string, ChartColor | string>,
  setLegendHeight: React.Dispatch<React.SetStateAction<number>>,
  activeLegend: string | undefined,
  onClick?: (category: string, color: string) => void,
  enableLegendSlider?: boolean,
  legendPosition?: "left" | "center" | "right",
  yAxisWidth?: number,
  textSize?: number,
  extraBottomPadding = 0,
) => {
  const legendRef = React.useRef<HTMLDivElement>(null);

  useOnWindowResize(() => {
    const calculateHeight = (height: number | undefined) =>
      height
        ? Number(height) + 15 + extraBottomPadding
        : 60 + extraBottomPadding;
    setLegendHeight(calculateHeight(legendRef.current?.clientHeight));
  });

  const legendPayload = payload.filter((item: any) => item.type !== "none");

  const paddingLeft =
    legendPosition === "left" && yAxisWidth ? yAxisWidth - 8 : 0;

  return (
    <div
      ref={legendRef}
      style={{ paddingLeft: paddingLeft }}
      className={cn(
        "flex items-center",
        { "justify-center": legendPosition === "center" },
        { "justify-start": legendPosition === "left" },
        { "justify-end": legendPosition === "right" },
      )}
    >
      <Legend
        categories={legendPayload.map((entry: any) => entry.value)}
        colors={legendPayload.map((entry: any) =>
          categoryColors.get(entry.value),
        )}
        onClickLegendItem={onClick}
        activeLegend={activeLegend}
        enableLegendSlider={enableLegendSlider}
        textSize={textSize}
      />
    </div>
  );
};

//#region Tooltip

type TooltipProps = Pick<ChartTooltipProps, "active" | "payload" | "label">;

type PayloadItem = {
  category: string;
  value: number;
  index: string;
  color: ChartColor | string;
  type?: string;
  payload: any;
};

interface ChartTooltipProps {
  active: boolean | undefined;
  payload: PayloadItem[];
  label: string;
  valueFormatter: (value: number) => string;
  showTotal?: boolean;
}

const ChartTooltip = ({
  active,
  payload,
  label,
  valueFormatter,
  showTotal = false,
}: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    const total = showTotal
      ? payload.reduce((sum, { value }) => sum + (value ?? 0), 0)
      : null;

    return (
      <div
        className={cn(
          // base
          "rounded-md border text-sm shadow-md",
          // border color
          "border-gray-200 dark:border-gray-800",
          // background color
          "bg-white dark:bg-gray-950",
        )}
      >
        <div className={cn("border-b border-inherit px-4 py-2")}>
          <p
            className={cn(
              // base
              "font-medium",
              // text color
              "text-gray-900 dark:text-gray-50",
            )}
          >
            {label}
          </p>
        </div>
        <div className={cn("space-y-1 px-4 py-2")}>
          {payload.map(({ value, category, color }, index) => (
            <div
              key={`id-${index}`}
              className="flex items-center justify-between gap-x-8"
            >
              <div className="flex items-center gap-x-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.75 w-3.5 shrink-0 rounded-full",
                    isHexColor(color as string)
                      ? undefined
                      : getColorClass(color as ChartColor, "bg"),
                  )}
                  style={
                    isHexColor(color as string)
                      ? { backgroundColor: color as string }
                      : undefined
                  }
                />
                <p
                  className={cn(
                    // base
                    "text-right whitespace-nowrap",
                    // text color
                    "text-gray-700 dark:text-gray-300",
                  )}
                >
                  {category}
                </p>
              </div>
              <p
                className={cn(
                  // base
                  "text-right font-medium whitespace-nowrap tabular-nums",
                  // text color
                  "text-gray-900 dark:text-gray-50",
                )}
              >
                {valueFormatter(value)}
              </p>
            </div>
          ))}
          {total !== null && (
            <div className="mt-1 flex items-center justify-between gap-x-8 border-t border-gray-200 pt-1 dark:border-gray-800">
              <p className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                Total
              </p>
              <p className="whitespace-nowrap tabular-nums font-medium text-gray-900 dark:text-gray-50">
                {valueFormatter(total)}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

//#region AreaChart

interface ActiveDot {
  index?: number;
  dataKey?: string;
}

type BaseEventProps = {
  eventType: "dot" | "category";
  categoryClicked: string;
  [key: string]: number | string;
};

type AreaChartEventProps = BaseEventProps | null | undefined;

interface AreaChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any>[];
  index: string;
  categories: string[];
  colors?: readonly (ChartColor | string)[];
  valueFormatter?: (value: number) => string;
  startEndOnly?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGridLines?: boolean;
  yAxisWidth?: number;
  intervalType?: "preserveStartEnd" | "equidistantPreserveStart";
  showTooltip?: boolean;
  showLegend?: boolean;
  autoMinValue?: boolean;
  autoYPadding?: number;
  softYAxis?: boolean | number;
  softYAxisScale?: CompactScale;
  minValue?: number;
  maxValue?: number;
  yAxisTicks?: number[];
  strictYAxisDomain?: boolean;
  allowDecimals?: boolean;
  allowNegativeY?: boolean;
  onValueChange?: (value: AreaChartEventProps) => void;
  enableLegendSlider?: boolean;
  tickGap?: number;
  connectNulls?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  type?: "default" | "stacked" | "percent";
  legendPosition?: "left" | "center" | "right";
  fill?: "gradient" | "solid" | "none";
  /**
   * Pinta a série ao longo do eixo X com um degradê horizontal, em vez de uma
   * cor só: uma parada por ponto, `offset` de 0 a 1 na ordem dos dados. Serve a
   * séries cujo SIGNIFICADO muda ao longo do tempo (enquadrado → alerta →
   * desenquadrado); entre duas paradas de cor diferente o SVG interpola, e a
   * transição sai suave sem que o gráfico precise ser cortado em fatias.
   *
   * Vale para a primeira série; com várias categorias a cor por categoria
   * continua sendo a identidade, e sobrepor as duas coisas confundiria.
   */
  xColorStops?: { offset: number; color: string }[];
  /**
   * Linhas horizontais de referência (limite, meta, alerta). Tracejadas por
   * convenção: é o que separa uma REGRA do dado — a grade continua sólida.
   *
   * Uma linha fora do domínio do eixo é descartada, não força o domínio a
   * crescer: um limite de 100% num gráfico que anda perto de 8% espremeria a
   * série inteira na base. Incluir a linha no domínio é decisão de quem chama
   * (é quem sabe se o limite é uma referência próxima ou um teto distante).
   */
  referenceLines?: {
    y: number;
    label?: string;
    color?: string;
    strokeDasharray?: string;
  }[];
  /**
   * Faixas verticais — o caso típico é o intervalo de confiança de uma
   * predição. O valor da linha em `key` é uma TUPLA `[inferior, superior]`
   * (ou `null` nos pontos onde a faixa não existe), que o recharts desenha
   * como área entre os dois limites.
   *
   * A faixa fica fora da legenda e do tooltip de propósito: ela é a incerteza
   * da série, não uma série a mais — listá-la faria o usuário ler dois números
   * a mais por ponto sem ganhar informação. Ela é desenhada ANTES das
   * categorias, então a linha sempre fica por cima.
   */
  bands?: {
    key: string;
    color?: ChartColor | string;
    fillOpacity?: number;
  }[];
  axisTextSize?: ChartTextSize;
  xAxisTextSize?: ChartTextSize;
  yAxisTextSize?: ChartTextSize;
  legendTextSize?: ChartTextSize;
  showDataPointLabels?: boolean;
  showDataPointLabelBackground?: boolean;
  dataPointTextSize?: ChartTextSize;
  dataPointLabelFormatter?: (value: number) => string;
  tooltipValueFormatter?: (value: number) => string;
  tooltipShowTotal?: boolean;
  showTotalDataPointLabels?: boolean;
  totalDataPointLabelPosition?: "top" | "bottom" | "line";
  tooltipCallback?: (tooltipCallbackContent: TooltipProps) => void;
  customTooltip?: React.ComponentType<TooltipProps>;
}

const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>(
  (props, ref) => {
    const {
      data = [],
      categories = [],
      index,
      colors = CHART_COLORS,
      valueFormatter = (value: number) => value.toString(),
      startEndOnly = false,
      showXAxis = true,
      showYAxis = true,
      showGridLines = true,
      yAxisWidth,
      intervalType = "equidistantPreserveStart",
      showTooltip = true,
      showLegend,
      autoMinValue = false,
      autoYPadding,
      softYAxis,
      softYAxisScale,
      allowNegativeY = false,
      minValue,
      maxValue,
      yAxisTicks,
      strictYAxisDomain = false,
      allowDecimals = true,
      connectNulls = false,
      className,
      onValueChange,
      enableLegendSlider = false,
      tickGap = 5,
      xAxisLabel,
      yAxisLabel,
      type = "default",
      legendPosition = "right",
      fill = "gradient",
      xColorStops,
      referenceLines,
      bands,
      axisTextSize = "xs",
      xAxisTextSize,
      yAxisTextSize,
      legendTextSize = "sm",
      showDataPointLabels = false,
      showDataPointLabelBackground = false,
      dataPointTextSize = "xs",
      dataPointLabelFormatter,
      tooltipValueFormatter,
      tooltipShowTotal = false,
      showTotalDataPointLabels = false,
      totalDataPointLabelPosition = "line",
      tooltipCallback,
      customTooltip,
      ...other
    } = props;
    const CustomTooltip = customTooltip;
    const paddingValue =
      (!showXAxis && !showYAxis) || (startEndOnly && !showYAxis) ? 0 : 20;
    const [legendHeight, setLegendHeight] = React.useState(60);
    const [activeDot, setActiveDot] = React.useState<ActiveDot | undefined>(
      undefined,
    );
    const [activeLegend, setActiveLegend] = React.useState<string | undefined>(
      undefined,
    );
    const categoryColors = constructCategoryColors(categories, colors);
    const shouldShowLegend = showLegend ?? categories.length > 1;

    const yAxisDomain = React.useMemo<
      [number | string, number | string]
    >(() => {
      // `computeYDomainWithPadding` só enxerga valor escalar, então a tupla de
      // uma faixa é ignorada e o topo dela ficaria fora do domínio (cortado, e
      // sem tick que o cubra). Achatar em duas chaves escalares resolve sem
      // mexer no helper, que é compartilhado com os outros gráficos.
      const bandKeys = bands?.map((band) => band.key) ?? [];
      // Empilhado fica de fora: ali o helper SOMA as categorias, e somar os
      // limites da faixa ao total daria um domínio sem sentido.
      const useBands =
        autoYPadding != null &&
        data.length > 0 &&
        bandKeys.length > 0 &&
        type !== "stacked";
      const domainData = useBands
        ? data.map((row) => {
            const extra: Record<string, unknown> = { ...row };
            for (const key of bandKeys) {
              const pair = row[key];
              if (Array.isArray(pair)) {
                extra[`${key}__lo`] = pair[0];
                extra[`${key}__hi`] = pair[1];
              }
            }
            return extra;
          })
        : data;
      const domainCategories = useBands
        ? [
            ...categories,
            ...bandKeys.flatMap((key) => [`${key}__lo`, `${key}__hi`]),
          ]
        : categories;
      const raw =
        autoYPadding != null && data.length > 0
          ? computeYDomainWithPadding(
              domainData,
              domainCategories,
              autoYPadding,
              type === "stacked",
            )
          : getYAxisDomain(autoMinValue, minValue, maxValue);
      return !allowNegativeY && typeof raw[0] === "number" && raw[0] < 0
        ? [0, raw[1]]
        : raw;
    }, [
      autoYPadding,
      data,
      categories,
      bands,
      type,
      autoMinValue,
      minValue,
      maxValue,
      allowNegativeY,
    ]);

    const { softTicks, softDomain, softResolvedScale, softAxisFormatter } =
      React.useMemo(() => {
        if (!softYAxis || type === "percent" || data.length === 0) {
          return {
            softTicks: undefined,
            softDomain: undefined,
            softResolvedScale: undefined,
            softAxisFormatter: undefined,
          };
        }
        const [domMin, domMax] = yAxisDomain;
        const numMin =
          type === "stacked" ? 0 : typeof domMin === "string" ? 0 : domMin;
        const numMax = typeof domMax === "string" ? 0 : domMax;
        const targetCount = typeof softYAxis === "number" ? softYAxis : 5;
        const ticks = computeNiceTicks(
          numMin,
          numMax,
          targetCount,
          allowNegativeY,
        );
        const scale = softYAxisScale ?? detectCompactScale(ticks);
        return {
          softTicks: ticks,
          softDomain: [ticks[0], ticks[ticks.length - 1]] as [number, number],
          softResolvedScale: scale,
          softAxisFormatter: (v: number) => formatCompactNumber(v, scale),
        };
      }, [
        softYAxis,
        softYAxisScale,
        allowNegativeY,
        type,
        data.length,
        yAxisDomain,
      ]);

    const resolvedXAxisTextSize = resolveTextSize(
      xAxisTextSize ?? axisTextSize,
    );
    const resolvedYAxisTextSize = resolveTextSize(
      yAxisTextSize ?? axisTextSize,
    );
    const resolvedLegendTextSize = resolveTextSize(legendTextSize);
    const resolvedDataPointTextSize = resolveTextSize(dataPointTextSize);
    const hasOnValueChange = !!onValueChange;
    const stacked = type === "stacked" || type === "percent";
    const areaId = React.useId();
    const TOTAL_KEY = `${areaId}__total__`;
    const TOTAL_ANCHOR_KEY = `${areaId}__totalAnchor__`;

    const dataWithTotals = React.useMemo(() => {
      if (!showTotalDataPointLabels || type === "percent") return data;
      const totals = data.map((d) =>
        categories.reduce(
          (sum, cat) =>
            sum + (typeof d[cat] === "number" ? (d[cat] as number) : 0),
          0,
        ),
      );
      const maxTotal = totals.length ? Math.max(...totals) : 0;
      return data.map((d, i) => ({
        ...d,
        [TOTAL_KEY]: totals[i],
        [TOTAL_ANCHOR_KEY]:
          totalDataPointLabelPosition === "top"
            ? maxTotal
            : totalDataPointLabelPosition === "bottom"
              ? 0
              : totals[i],
      }));
    }, [
      data,
      categories,
      showTotalDataPointLabels,
      type,
      totalDataPointLabelPosition,
      TOTAL_KEY,
      TOTAL_ANCHOR_KEY,
    ]);

    const resolvedYAxisWidth = React.useMemo(() => {
      if (yAxisWidth !== undefined) return yAxisWidth;
      if (type === "percent") {
        // Recharts normalizes stacked percent charts to a 0–1 domain,
        // so ticks are always 0%–100%. Measure against that range, not raw data values.
        return inferYAxisWidth(
          [{ v: 0 }, { v: 0.5 }, { v: 1 }],
          ["v"],
          (v) => `${(v * 100).toFixed(0)}%`,
        );
      }
      const axisTicks = softTicks ?? yAxisTicks;
      if (axisTicks) {
        const longest = axisTicks.reduce((acc, t) => {
          const f = softTicks
            ? formatCompactNumber(t, softResolvedScale)
            : valueFormatter(t);
          return f.length > acc.length ? f : acc;
        }, "");
        // Extra padding so compact labels ("371.11 MM") are not clipped on the left.
        return Math.max(56, Math.ceil(measureTextWidth(longest) * 1.2) + 28);
      }
      return Math.max(
        56,
        inferYAxisWidth(data, categories, valueFormatter, 28),
      );
    }, [
      yAxisWidth,
      data,
      categories,
      type,
      valueFormatter,
      softTicks,
      yAxisTicks,
      softResolvedScale,
    ]);

    // Once per series, not once per point: the `dot` renderer below asks this
    // for every point of every series on every render (a hover is a render).
    const singleValueByCategory = React.useMemo(
      () => onlyOneValueByKey(data, categories),
      [data, categories],
    );
    const hasOnlyOneValue = (key: string) =>
      singleValueByCategory.get(key) ?? hasOnlyOneValueForKey(data, key);

    const prevActiveRef = React.useRef<boolean | undefined>(undefined);
    const prevLabelRef = React.useRef<string | undefined>(undefined);

    const getFillContent = ({
      fillType,
      activeDot,
      activeLegend,
      category,
      hexColor,
    }: {
      fillType: AreaChartProps["fill"];
      activeDot: ActiveDot | undefined;
      activeLegend: string | undefined;
      category: string;
      hexColor?: string;
    }) => {
      const stopOpacity =
        activeDot || (activeLegend && activeLegend !== category) ? 0.1 : 0.3;
      const stopColor = hexColor ?? "currentColor";

      switch (fillType) {
        case "none":
          return <stop stopColor={stopColor} stopOpacity={0} />;
        case "gradient":
          return (
            <>
              <stop
                offset="5%"
                stopColor={stopColor}
                stopOpacity={stopOpacity}
              />
              <stop offset="95%" stopColor={stopColor} stopOpacity={0} />
            </>
          );
        case "solid":
        default:
          return <stop stopColor={stopColor} stopOpacity={stopOpacity} />;
      }
    };

    function valueToPercent(value: number) {
      return `${(value * 100).toFixed(0)}%`;
    }

    function onDotClick(itemData: any, event: React.MouseEvent) {
      event.stopPropagation();

      if (!hasOnValueChange) return;
      if (
        (itemData.index === activeDot?.index &&
          itemData.dataKey === activeDot?.dataKey) ||
        (hasOnlyOneValue(itemData.dataKey) &&
          activeLegend &&
          activeLegend === itemData.dataKey)
      ) {
        setActiveLegend(undefined);
        setActiveDot(undefined);
        onValueChange?.(null);
      } else {
        setActiveLegend(itemData.dataKey);
        setActiveDot({
          index: itemData.index,
          dataKey: itemData.dataKey,
        });
        onValueChange?.({
          eventType: "dot",
          categoryClicked: itemData.dataKey,
          ...itemData.payload,
        });
      }
    }

    function onCategoryClick(dataKey: string) {
      if (!hasOnValueChange) return;
      if (
        (dataKey === activeLegend && !activeDot) ||
        (hasOnlyOneValue(dataKey) &&
          activeDot &&
          activeDot.dataKey === dataKey)
      ) {
        setActiveLegend(undefined);
        onValueChange?.(null);
      } else {
        setActiveLegend(dataKey);
        onValueChange?.({
          eventType: "category",
          categoryClicked: dataKey,
        });
      }
      setActiveDot(undefined);
    }

    return (
      <div
        ref={ref}
        className={cn(
          "h-full min-h-0 w-full max-h-full **:outline-none",
          className,
        )}
        {...other}
      >
        <MeasuredResponsiveContainer width="100%" height="100%">
          <RechartsAreaChart
            data={dataWithTotals}
            onClick={
              hasOnValueChange && (activeLegend || activeDot)
                ? () => {
                    setActiveDot(undefined);
                    setActiveLegend(undefined);
                    onValueChange?.(null);
                  }
                : undefined
            }
            margin={{
              bottom: xAxisLabel ? 30 : undefined,
              // Keep a few px when Y is visible so tick labels are not flush-clipped.
              left: yAxisLabel ? 20 : showYAxis ? 4 : undefined,
              right: yAxisLabel ? 5 : 8,
              top:
                showTotalDataPointLabels &&
                totalDataPointLabelPosition === "top"
                  ? 32
                  : showDataPointLabels ||
                      (showTotalDataPointLabels &&
                        totalDataPointLabelPosition === "line")
                    ? 20
                    : 5,
            }}
            stackOffset={type === "percent" ? "expand" : undefined}
          >
            {showGridLines ? (
              <CartesianGrid
                className={cn("stroke-gray-200 stroke-1 dark:stroke-gray-800")}
                horizontal={true}
                vertical={false}
              />
            ) : null}
            {/* Depois da grade e antes das áreas: a série passa por cima da
                referência, que é anotação e não deve competir com o dado. */}
            {referenceLines?.map((line, lineIndex) => (
              <ReferenceLine
                key={`reference-${lineIndex}-${line.y}`}
                y={line.y}
                ifOverflow="discard"
                stroke={line.color ?? "currentColor"}
                strokeDasharray={line.strokeDasharray ?? "4 4"}
                strokeWidth={1}
                className={
                  line.color
                    ? undefined
                    : "stroke-gray-400 dark:stroke-gray-600"
                }
                label={
                  line.label
                    ? {
                        value: line.label,
                        position: "insideTopRight",
                        fill: line.color ?? "currentColor",
                        fontSize: 11,
                      }
                    : undefined
                }
              />
            ))}
            <XAxis
              padding={{ left: paddingValue, right: paddingValue }}
              hide={!showXAxis}
              dataKey={index}
              interval={startEndOnly ? "preserveStartEnd" : intervalType}
              tick={{
                transform:
                  showTotalDataPointLabels &&
                  totalDataPointLabelPosition === "bottom"
                    ? "translate(0, 28)"
                    : "translate(0, 6)",
                fontSize: resolvedXAxisTextSize,
                className: AXIS_TICK_CLASS,
              }}
              ticks={
                startEndOnly
                  ? [data[0][index], data[data.length - 1][index]]
                  : undefined
              }
              fill=""
              stroke=""
              className="text-xs"
              tickLine={false}
              axisLine={false}
              minTickGap={tickGap}
            >
              {xAxisLabel && (
                <Label
                  position="insideBottom"
                  offset={-20}
                  className="fill-gray-800 text-sm font-medium dark:fill-gray-200"
                >
                  {xAxisLabel}
                </Label>
              )}
            </XAxis>
            <YAxis
              width={resolvedYAxisWidth}
              hide={!showYAxis}
              axisLine={false}
              tickLine={false}
              type="number"
              domain={(softDomain ?? yAxisDomain) as AxisDomain}
              ticks={softTicks ?? yAxisTicks}
              allowDataOverflow={strictYAxisDomain}
              tick={{
                transform: "translate(0, 0)",
                fontSize: resolvedYAxisTextSize,
                className: AXIS_TICK_CLASS,
              }}
              fill=""
              stroke=""
              className="text-xs"
              tickFormatter={
                type === "percent"
                  ? valueToPercent
                  : (softAxisFormatter ?? valueFormatter)
              }
              allowDecimals={allowDecimals}
            >
              {yAxisLabel && (
                <Label
                  position="insideLeft"
                  style={{ textAnchor: "middle" }}
                  angle={-90}
                  offset={-15}
                  className="fill-gray-800 text-sm font-medium dark:fill-gray-200"
                >
                  {yAxisLabel}
                </Label>
              )}
            </YAxis>
            <Tooltip
              wrapperStyle={{ outline: "none", zIndex: 10 }}
              isAnimationActive={true}
              animationDuration={100}
              cursor={{ stroke: "#d1d5db", strokeWidth: 1 }}
              offset={20}
              position={{ y: 0 }}
              content={({ active, payload, label }) => {
                const cleanPayload: TooltipProps["payload"] = payload
                  ? payload
                      .filter((item: any) => categories.includes(item.dataKey))
                      .map((item: any) => ({
                        category: item.dataKey,
                        value: item.value,
                        index: item.payload[index],
                        color: categoryColors.get(item.dataKey) as ChartColor,
                        type: item.type,
                        payload: item.payload,
                      }))
                  : [];

                const labelStr = String(label ?? "");

                if (
                  tooltipCallback &&
                  (active !== prevActiveRef.current ||
                    labelStr !== prevLabelRef.current)
                ) {
                  tooltipCallback({
                    active,
                    payload: cleanPayload,
                    label: labelStr,
                  });
                  prevActiveRef.current = active;
                  prevLabelRef.current = labelStr;
                }

                return showTooltip && active ? (
                  CustomTooltip ? (
                    <CustomTooltip
                      active={active}
                      payload={cleanPayload}
                      label={labelStr}
                    />
                  ) : (
                    <ChartTooltip
                      active={active}
                      payload={cleanPayload}
                      label={labelStr}
                      valueFormatter={tooltipValueFormatter ?? valueFormatter}
                      showTotal={tooltipShowTotal}
                    />
                  )
                ) : null;
              }}
            />

            {shouldShowLegend ? (
              <RechartsLegend
                verticalAlign="top"
                height={legendHeight}
                content={({ payload }) =>
                  ChartLegend(
                    { payload },
                    categoryColors,
                    setLegendHeight,
                    activeLegend,
                    hasOnValueChange
                      ? (clickedLegendItem: string) =>
                          onCategoryClick(clickedLegendItem)
                      : undefined,
                    enableLegendSlider,
                    legendPosition,
                    resolvedYAxisWidth,
                    resolvedLegendTextSize,
                    showTotalDataPointLabels &&
                      totalDataPointLabelPosition === "top"
                      ? 24
                      : 0,
                  )
                }
              />
            ) : null}
            {bands?.map((band) => (
              // Antes das categorias de propósito: a ordem de render é a ordem
              // de pintura, então a faixa fica por baixo da linha.
              <Area
                key={`band-${band.key}`}
                name={band.key}
                dataKey={band.key}
                stroke="none"
                fill={chartColorToCss(
                  (band.color ?? colors[0] ?? "blue") as ChartColor | string,
                )}
                fillOpacity={band.fillOpacity ?? 0.15}
                isAnimationActive={false}
                activeDot={false}
                dot={false}
                legendType="none"
                tooltipType="none"
                connectNulls={false}
              />
            ))}
            {categories.map((category, categoryIndex) => {
              const categoryId = `${areaId}-${category.replace(/[^a-zA-Z0-9]/g, "")}`;
              // Só a primeira série, e só quando há paradas: com várias
              // categorias a cor É a identidade de cada uma.
              const xStops =
                categoryIndex === 0 && xColorStops && xColorStops.length > 0
                  ? xColorStops
                  : undefined;
              const xGradientId = `${categoryId}-x`;
              return (
                <React.Fragment key={category}>
                  <defs key={`defs-${category}`}>
                    {xStops ? (
                      // `objectBoundingBox` (padrão): 0 e 1 são as bordas da
                      // própria área desenhada, que vai exatamente do primeiro
                      // ao último ponto — daí `offset = índice / (n - 1)`.
                      <linearGradient
                        id={xGradientId}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        {xStops.map((stop, stopIndex) => (
                          <stop
                            key={`${xGradientId}-${stopIndex}`}
                            offset={stop.offset}
                            stopColor={stop.color}
                          />
                        ))}
                      </linearGradient>
                    ) : null}
                    <linearGradient
                      key={`gradient-${category}`}
                      className={cn(
                        isHexColor(categoryColors.get(category) as string)
                          ? undefined
                          : getColorClass(
                              categoryColors.get(category) as ChartColor,
                              "text",
                            ),
                      )}
                      id={categoryId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      {getFillContent({
                        fillType: fill,
                        activeDot: activeDot,
                        activeLegend: activeLegend,
                        category: category,
                        hexColor: isHexColor(
                          categoryColors.get(category) as string,
                        )
                          ? (categoryColors.get(category) as string)
                          : undefined,
                      })}
                    </linearGradient>
                  </defs>
                  <Area
                    className={cn(
                      // Com degradê a classe tem de sair: CSS vence atributo de
                      // apresentação, então `stroke-emerald-500` anularia o
                      // `url(#...)` abaixo sem deixar rastro.
                      xStops ||
                        isHexColor(categoryColors.get(category) as string)
                        ? undefined
                        : getColorClass(
                            categoryColors.get(category) as ChartColor,
                            "stroke",
                          ),
                    )}
                    strokeOpacity={
                      activeDot || (activeLegend && activeLegend !== category)
                        ? 0.3
                        : 1
                    }
                    activeDot={(props: any) => {
                      const {
                        cx: cxCoord,
                        cy: cyCoord,
                        stroke,
                        strokeLinecap,
                        strokeLinejoin,
                        strokeWidth,
                        dataKey,
                        index: dotIndex,
                      } = props;
                      // Com degradê o ponto ativo tem de sair na cor DAQUELE x,
                      // não na cor da série: um ponto verde num trecho laranja
                      // contradiz a linha embaixo dele.
                      const dotColor = xStops?.[dotIndex as number]?.color;
                      return (
                        <g
                          onClick={(event) => onDotClick(props, event)}
                          className={onValueChange ? "cursor-pointer" : ""}
                        >
                          <circle
                            cx={cxCoord}
                            cy={cyCoord}
                            r={14}
                            fill="transparent"
                            stroke="none"
                          />
                          <Dot
                            className={cn(
                              "stroke-white dark:stroke-gray-950",
                              dotColor ||
                                isHexColor(
                                  categoryColors.get(dataKey) as string,
                                )
                                ? undefined
                                : getColorClass(
                                    categoryColors.get(dataKey) as ChartColor,
                                    "fill",
                                  ),
                            )}
                            cx={cxCoord}
                            cy={cyCoord}
                            r={5}
                            fill={
                              dotColor ??
                              (isHexColor(categoryColors.get(dataKey) as string)
                                ? (categoryColors.get(dataKey) as string)
                                : "")
                            }
                            stroke={stroke}
                            strokeLinecap={strokeLinecap}
                            strokeLinejoin={strokeLinejoin}
                            strokeWidth={strokeWidth}
                          />
                        </g>
                      );
                    }}
                    dot={(props: any) => {
                      const {
                        stroke,
                        strokeLinecap,
                        strokeLinejoin,
                        strokeWidth,
                        cx: cxCoord,
                        cy: cyCoord,
                        dataKey,
                        index,
                      } = props;

                      if (
                        (hasOnlyOneValue(category) &&
                          !(
                            activeDot ||
                            (activeLegend && activeLegend !== category)
                          )) ||
                        (activeDot?.index === index &&
                          activeDot?.dataKey === category)
                      ) {
                        return (
                          <Dot
                            key={index}
                            cx={cxCoord}
                            cy={cyCoord}
                            r={5}
                            stroke={stroke}
                            fill={
                              isHexColor(categoryColors.get(dataKey) as string)
                                ? (categoryColors.get(dataKey) as string)
                                : ""
                            }
                            strokeLinecap={strokeLinecap}
                            strokeLinejoin={strokeLinejoin}
                            strokeWidth={strokeWidth}
                            className={cn(
                              "stroke-white dark:stroke-gray-950",
                              onValueChange ? "cursor-pointer" : "",
                              isHexColor(categoryColors.get(dataKey) as string)
                                ? undefined
                                : getColorClass(
                                    categoryColors.get(dataKey) as ChartColor,
                                    "fill",
                                  ),
                            )}
                          />
                        );
                      }
                      return <React.Fragment key={index}></React.Fragment>;
                    }}
                    key={`area-${category}`}
                    name={category}
                    type="linear"
                    dataKey={category}
                    stroke={
                      xStops
                        ? `url(#${xGradientId})`
                        : isHexColor(categoryColors.get(category) as string)
                          ? (categoryColors.get(category) as string)
                          : ""
                    }
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    isAnimationActive={false}
                    connectNulls={connectNulls}
                    stackId={stacked ? "stack" : undefined}
                    // Sem o degradê vertical de `getFillContent`, a área vira o
                    // mesmo degradê horizontal em opacidade de lavagem.
                    fill={
                      xStops ? `url(#${xGradientId})` : `url(#${categoryId})`
                    }
                    fillOpacity={xStops ? 0.12 : undefined}
                  >
                    {showDataPointLabels ? (
                      <LabelList
                        dataKey={category}
                        content={(props: any) => {
                          const { x, y, value, index: pointIndex } = props;
                          if (value == null) return null;

                          const formatted =
                            type === "percent"
                              ? valueToPercent(value)
                              : (dataPointLabelFormatter ?? valueFormatter)(
                                  value,
                                );

                          const offset = 8;
                          const fontSize = resolvedDataPointTextSize;
                          const paddingX = 5;
                          const paddingY = 2;
                          const bgWidth =
                            measureTextWidth(formatted) + paddingX * 2;
                          const bgHeight = fontSize + paddingY * 2;
                          const rectY = y - offset - bgHeight;
                          const color = categoryColors.get(
                            category,
                          ) as ChartColor;

                          return (
                            <g key={`label-${category}-${pointIndex}`}>
                              {showDataPointLabelBackground && (
                                <rect
                                  x={x - bgWidth / 2}
                                  y={rectY}
                                  width={bgWidth}
                                  height={bgHeight}
                                  rx={4}
                                  className={cn(
                                    getColorClass(color, "fill"),
                                    "opacity-15",
                                  )}
                                />
                              )}
                              <text
                                x={x}
                                y={rectY + bgHeight / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={fontSize}
                                className={cn(
                                  "font-medium",
                                  showDataPointLabelBackground
                                    ? getColorClass(color, "fill")
                                    : "fill-gray-600 dark:fill-gray-200",
                                )}
                              >
                                {formatted}
                              </text>
                            </g>
                          );
                        }}
                      />
                    ) : null}
                  </Area>
                </React.Fragment>
              );
            })}
            {showTotalDataPointLabels && type !== "percent" && (
              <Area
                key={TOTAL_ANCHOR_KEY}
                name={TOTAL_ANCHOR_KEY}
                dataKey={TOTAL_ANCHOR_KEY}
                stroke="transparent"
                fill="transparent"
                strokeWidth={0}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                legendType="none"
                tooltipType="none"
              >
                <LabelList
                  dataKey={TOTAL_KEY}
                  content={(props: any) => {
                    const { x, y, value, index: pointIndex } = props;
                    if (value == null) return null;

                    const formatted = (
                      dataPointLabelFormatter ?? valueFormatter
                    )(value);
                    const fontSize = resolvedDataPointTextSize;
                    const paddingX = 5;
                    const paddingY = 2;
                    const bgWidth = measureTextWidth(formatted) + paddingX * 2;
                    const bgHeight = fontSize + paddingY * 2;
                    const labelY =
                      totalDataPointLabelPosition === "bottom"
                        ? y + 4
                        : y - 8 - bgHeight;

                    return (
                      <g key={`total-label-${pointIndex}`}>
                        {showDataPointLabelBackground && (
                          <rect
                            x={x - bgWidth / 2}
                            y={labelY}
                            width={bgWidth}
                            height={bgHeight}
                            rx={4}
                            className="fill-gray-500 opacity-15"
                          />
                        )}
                        <text
                          x={x}
                          y={labelY + bgHeight / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={fontSize}
                          className="fill-gray-600 font-medium dark:fill-gray-200"
                        >
                          {formatted}
                        </text>
                      </g>
                    );
                  }}
                />
              </Area>
            )}

            {/* hidden lines to increase clickable target area */}
            {onValueChange
              ? categories.map((category) => (
                  <Line
                    className={cn("cursor-pointer")}
                    strokeOpacity={0}
                    key={`line-${category}`}
                    name={category}
                    type="linear"
                    dataKey={category}
                    stroke="transparent"
                    fill="transparent"
                    legendType="none"
                    tooltipType="none"
                    strokeWidth={12}
                    connectNulls={connectNulls}
                    onClick={(props: any, event) => {
                      event.stopPropagation();
                      const { name } = props;
                      onCategoryClick(name);
                    }}
                  />
                ))
              : null}
          </RechartsAreaChart>
        </MeasuredResponsiveContainer>
      </div>
    );
  },
);

AreaChart.displayName = "AreaChart";

export {
  AreaChart,
  type AreaChartEventProps,
  type ChartTextSize,
  type TooltipProps,
};
