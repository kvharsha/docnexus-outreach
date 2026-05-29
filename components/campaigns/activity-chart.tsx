"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";

import { getActivitySeries } from "@/lib/utils/mock-metrics";

type Props = { campaignId: string; enrolledCount: number; launched: boolean };

// teal-700, the one accent colour in the system.
const BAR_COLOR = "#0f766e";
const CHART_HEIGHT = 256; // matches the h-64 wrapper

export function ActivityChart({ campaignId, enrolledCount, launched }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Measured pixel width of the wrapper. ResponsiveContainer logs "width(-1) height(-1)" because it
  // tries to measure before the grid cell has a resolved width on the first client paint. Instead we
  // measure the wrapper ourselves with a ResizeObserver and feed a concrete pixel width to a
  // fixed-size BarChart. width stays 0 until the observer fires, and we render nothing until then —
  // so Recharts never sees an unresolved (-1) dimension. This also doubles as the mount-gate: the
  // effect only runs in the browser, so the server render is just the empty wrapper.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Seed from the current layout, then keep in sync as the card/grid cell resizes.
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      if (measured > 0) setWidth(measured);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Deterministic from the campaign id — stable across reloads. Draft campaigns get a flat zero series.
  const data = getActivitySeries(campaignId, enrolledCount, launched);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="pb-3 text-sm font-medium text-zinc-950">Outreach activity — last 7 days</h2>
      <div ref={wrapperRef} className="h-64 w-full">
        {width > 0 && (
          <BarChart
            width={width}
            height={CHART_HEIGHT}
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
          >
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
            />
            <Tooltip
              cursor={{ fill: "#fafafa" }}
              contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
            />
            <Bar dataKey="sends" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </div>
    </div>
  );
}
