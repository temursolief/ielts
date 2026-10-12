"use client";

import { useMemo } from "react";

type ActivityDay = {
  date: string; // "YYYY-MM-DD"
  count: number;
};

type ActivityHeatmapProps = {
  data: ActivityDay[];
  weeks?: number; // how many weeks to show, default 26
};

const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

function getIntensity(count: number): string {
  if (count === 0) return "bg-[#EDF5EF]";
  if (count === 1) return "bg-[#A8D5B8]";
  if (count <= 3) return "bg-[#5CB07A]";
  if (count <= 6) return "bg-[#2E8A50]";
  return "bg-[#176B4D]";
}

export function ActivityHeatmap({ data, weeks = 26 }: ActivityHeatmapProps) {
  const grid = useMemo(() => {
    const map = new Map(data.map((d) => [d.date, d.count]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from `weeks` weeks ago, aligned to Sunday
    const start = new Date(today);
    start.setDate(start.getDate() - weeks * 7 + 1);
    const dayOfWeek = start.getDay(); // 0=Sun
    start.setDate(start.getDate() - dayOfWeek);

    const columns: { date: string; count: number }[][] = [];
    let current = new Date(start);

    while (current <= today) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = current.toISOString().slice(0, 10);
        const isFuture = current > today;
        week.push({ date: dateStr, count: isFuture ? -1 : (map.get(dateStr) ?? 0) });
        current.setDate(current.getDate() + 1);
      }
      columns.push(week);
    }
    return columns;
  }, [data, weeks]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((week, i) => {
      const d = new Date(week[0].date);
      const m = d.getMonth();
      if (m !== lastMonth) {
        labels.push({
          label: d.toLocaleString("default", { month: "short" }),
          col: i,
        });
        lastMonth = m;
      }
    });
    return labels;
  }, [grid]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-max">
        {/* Month labels */}
        <div className="flex ml-7 gap-0.5 mb-0.5">
          {grid.map((_, i) => {
            const label = monthLabels.find((l) => l.col === i);
            return (
              <div key={i} className="w-3 text-[10px] text-[#5C6E62]">
                {label?.label ?? ""}
              </div>
            );
          })}
        </div>

        {/* Grid rows: 7 days */}
        {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-0.5">
            <div className="w-6 text-right text-[10px] text-[#5C6E62] pr-1 select-none">
              {DAYS[dayIdx]}
            </div>
            {grid.map((week, wi) => {
              const cell = week[dayIdx];
              if (cell.count === -1)
                return <div key={wi} className="w-3 h-3" />;
              return (
                <div
                  key={wi}
                  title={`${cell.date}: ${cell.count} ${cell.count === 1 ? "activity" : "activities"}`}
                  className={`w-3 h-3 rounded-sm cursor-default transition-opacity hover:opacity-80 ${getIntensity(cell.count)}`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-1 mt-1 ml-7">
          <span className="text-[10px] text-[#5C6E62] mr-1">Less</span>
          {[0, 1, 3, 5, 7].map((n) => (
            <div
              key={n}
              className={`w-3 h-3 rounded-sm ${getIntensity(n)}`}
            />
          ))}
          <span className="text-[10px] text-[#5C6E62] ml-1">More</span>
        </div>
      </div>
    </div>
  );
}
