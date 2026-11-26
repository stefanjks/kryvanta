"use client";
import { BarChart, type Point } from "./BarChart";

const rub = (k: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: k % 100 ? 2 : 0 }).format(k / 100);

export function RubChart(props: { data: Point[]; title: string; tableLabel?: string }) {
  return <BarChart {...props} format={rub} />;
}
export function CountChart(props: { data: Point[]; title: string; tableLabel?: string }) {
  return <BarChart {...props} format={(v) => String(v)} />;
}
