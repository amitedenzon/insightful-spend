import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';

interface TrendLineChartProps {
  data: { month: string; amount: number }[];
}

export function TrendLineChart({ data }: TrendLineChartProps) {
  const maxAmount = Math.max(...data.map(d => d.amount));

  if (maxAmount === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        אין נתונים לשנה זו
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--border))" 
            vertical={false}
          />
          <XAxis 
            dataKey="month" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₪${(v/1000).toFixed(0)}K`}
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
              'סה"כ הוצאות'
            ]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            fill="url(#colorAmount)"
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
            activeDot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
