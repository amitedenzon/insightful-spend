import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface MonthlyPieChartProps {
  data: { month: string; amount: number }[];
  onMonthClick?: (monthName: string) => void;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-1) / 0.6)',
  'hsl(var(--chart-2) / 0.6)',
  'hsl(var(--chart-3) / 0.6)',
  'hsl(var(--chart-4) / 0.6)',
  'hsl(var(--chart-5) / 0.6)',
  'hsl(var(--chart-6) / 0.6)',
];

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

export function MonthlyPieChart({ data, onMonthClick }: MonthlyPieChartProps) {
  const filteredData = data.filter(d => d.amount > 0);
  const total = filteredData.reduce((sum, d) => sum + d.amount, 0);

  if (total === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-muted-foreground">
        אין נתונים לשנה זו
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 min-h-[280px]">
      <div className="relative w-[200px] h-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={98}
              dataKey="amount"
              nameKey="month"
              stroke="hsl(var(--card))"
              strokeWidth={2}
              onClick={(d) => onMonthClick?.(d.month)}
              className="cursor-pointer outline-none"
            >
              {filteredData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[data.findIndex(d => d.month === entry.month) % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
                direction: 'rtl',
                color: 'hsl(var(--foreground))',
                padding: '6px 10px',
              }}
              itemStyle={{ color: 'hsl(var(--foreground))', padding: 0 }}
              formatter={(value: number, name: string) => [formatILS(value), name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] text-muted-foreground">סה״כ</div>
          <div className="text-base font-semibold text-foreground tabular-nums">{formatILS(total)}</div>
        </div>
      </div>

      <ul className="flex-1 min-w-0 space-y-1 text-sm max-h-[240px] overflow-auto pl-1">
        {filteredData.map((entry) => {
          const colorIndex = data.findIndex(d => d.month === entry.month);
          const pct = total > 0 ? (entry.amount / total) * 100 : 0;
          return (
            <li
              key={entry.month}
              onClick={() => onMonthClick?.(entry.month)}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1 transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: COLORS[colorIndex % COLORS.length] }}
              />
              <span className="flex-1 min-w-0 text-foreground">{entry.month}</span>
              <span className="text-muted-foreground tabular-nums text-xs w-10 text-left">
                {pct.toFixed(0)}%
              </span>
              <span className="font-medium text-foreground tabular-nums text-xs w-20 text-left">
                {formatILS(entry.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
