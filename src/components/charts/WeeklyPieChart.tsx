import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { WeeklyData } from '@/types/transaction';

interface WeeklyPieChartProps {
  data: WeeklyData[];
}

const COLORS = [
  'hsl(239, 84%, 67%)', // Primary/Indigo
  'hsl(160, 84%, 39%)', // Savings/Emerald
  'hsl(350, 89%, 60%)', // Spending/Rose
  'hsl(38, 92%, 50%)',  // Warning/Amber
];

export function WeeklyPieChart({ data }: WeeklyPieChartProps) {
  const formattedData = data.map(d => ({
    name: `ימים ${d.label}`,
    value: Math.round(d.amount),
  }));

  const total = formattedData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        אין נתונים לתקופה זו
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={formattedData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            strokeWidth={0}
          >
            {formattedData.map((_, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                className="transition-all duration-300 hover:opacity-80"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              direction: 'rtl',
              color: 'hsl(var(--foreground))',
            }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number) => [
              value.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' }),
              'סכום'
            ]}
          />
          <Legend 
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ direction: 'rtl' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
