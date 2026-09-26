import {
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays} from "date-fns";
import { enUS } from "date-fns/locale";

import type { DateRangePreset } from "./types";

export const defaultDateRangePresets: DateRangePreset[] = [
  {
    id: "today",
    label: "Today",
    getRange: () => {
      const d = startOfDay(new Date());
      return { from: d, to: d };
    }},
  {
    id: "yesterday",
    label: "Yesterday",
    getRange: () => {
      const d = startOfDay(subDays(new Date(), 1));
      return { from: d, to: d };
    }},
  {
    id: "last7",
    label: "Last 7 days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: startOfDay(new Date())})},
  {
    id: "last14",
    label: "Last 14 days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 13)),
      to: startOfDay(new Date())})},
  {
    id: "last30",
    label: "Last 30 days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: startOfDay(new Date())})},
  {
    id: "thisWeek",
    label: "This week",
    getRange: () => ({
      from: startOfWeek(new Date(), { locale: enUS }),
      to: endOfWeek(new Date(), { locale: enUS })})},
  {
    id: "lastWeek",
    label: "Last week",
    getRange: () => {
      const n = new Date();
      const lastWeek = subDays(n, 7);
      return {
        from: startOfWeek(lastWeek, { locale: enUS }),
        to: endOfWeek(lastWeek, { locale: enUS })};
    }},
  {
    id: "thisMonth",
    label: "This month",
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())})},
  {
    id: "lastMonth",
    label: "Last month",
    getRange: () => {
      const n = new Date();
      const last = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    }},
];
