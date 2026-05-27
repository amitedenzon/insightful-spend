import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface CategoryPieChartProps {
  data: { name: string; value: number }[];
  onCategoryClick?: (category: string) => void;
}

// Tied to the chart-N CSS variables so the palette tracks the theme. Calmer
// than the previous hard-coded jewel tones.
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
];

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

export function CategoryPieChart({ data, onCategoryClick }: CategoryPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-muted-foreground">
        אין נתונים לתקופה זו
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 min-h-[280px]">
      {/* Donut with the total stamped in the middle. Thin, no padding angle. */}
      <div className="relative w-[200px] h-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={98}
              dataKey="value"
              nameKey="name"
              stroke="hsl(var(--card))"
              strokeWidth={2}
              onClick={(d) => onCategoryClick?.(d.name)}
              className="cursor-pointer outline-none"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [formatILS(value), name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] text-muted-foreground">סה״כ</div>
          <div className="text-base font-semibold text-foreground tabular-nums">
            {formatILS(total)}
          </div>
        </div>
      </div>

      {/* Compact legend with percentage + amount. Click jumps to that category. */}
      <ul className="flex-1 min-w-0 space-y-1.5 text-sm max-h-[240px] overflow-auto pl-1">
        {data.map((d, index) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <li
              key={d.name}
              onClick={() => onCategoryClick?.(d.name)}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1 transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="flex-1 min-w-0 text-foreground">{d.name}</span>
              <span className="text-muted-foreground tabular-nums text-xs w-10 text-left">
                {pct.toFixed(0)}%
              </span>
              <span className="font-medium text-foreground tabular-nums text-xs w-20 text-left">
                {formatILS(d.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
