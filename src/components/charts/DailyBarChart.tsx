import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { DailyData } from '@/types/transaction';

interface DailyBarChartProps {
  data: DailyData[];
}

export function DailyBarChart({ data }: DailyBarChartProps) {
  const maxAmount = Math.max(...data.map(d => d.amount));

  if (maxAmount === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        אין נתונים לתקופה זו
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
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
              'הוצאות'
            ]}
            labelFormatter={(label) => `יום ${label}`}
          />
          <Bar 
            dataKey="amount" 
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
