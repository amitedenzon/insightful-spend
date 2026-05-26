import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { DailyData } from '@/types/transaction';

interface DailyBarChartProps {
  data: DailyData[];
  onDayClick?: (day: number) => void;
}

export function DailyBarChart({ data, onDayClick }: DailyBarChartProps) {
  // Net-negative days (refund-heavy) are clamped to 0 so the axis baseline
  // stays at 0 and the visual stays a "daily spend" chart, not a net-flow chart.
  const sanitized = data.map(d => ({ ...d, amount: Math.max(0, d.amount) }));
  const maxAmount = Math.max(...sanitized.map(d => d.amount));

  if (maxAmount === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        אין נתונים לתקופה זו
      </div>
    );
  }

  const formatTick = (v: number) => {
    if (v >= 1000) {
      const k = v / 1000;
      return `₪${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
    }
    return `₪${v}`;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sanitized}
          margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
          onClick={(e) => {
            const day = (e?.activePayload?.[0]?.payload as DailyData | undefined)?.day;
            if (typeof day === 'number') onDayClick?.(day);
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={2}
            padding={{ left: 24, right: 8 }}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatTick}
            domain={[0, 'auto']}
            allowDataOverflow={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              direction: 'rtl',
            }}
            formatter={(value: number) => [
              value.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' }),
              'הוצאות'
            ]}
            labelFormatter={(label) => `יום ${label}`}
          />
          <Bar
            dataKey="amount"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
            cursor={onDayClick ? 'pointer' : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
