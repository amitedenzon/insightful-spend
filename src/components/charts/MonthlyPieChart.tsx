import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface MonthlyPieChartProps {
  data: { month: string; amount: number }[];
}

const COLORS = [
  'hsl(239, 84%, 67%)',
  'hsl(160, 84%, 39%)',
  'hsl(350, 89%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 65%, 60%)',
  'hsl(200, 80%, 55%)',
  'hsl(239, 60%, 75%)',
  'hsl(160, 60%, 55%)',
  'hsl(350, 70%, 70%)',
  'hsl(38, 70%, 60%)',
  'hsl(280, 50%, 70%)',
  'hsl(200, 60%, 65%)',
];

export function MonthlyPieChart({ data }: MonthlyPieChartProps) {
  const filteredData = data.filter(d => d.amount > 0);
  const total = filteredData.reduce((sum, d) => sum + d.amount, 0);

  if (total === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        אין נתונים לשנה זו
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filteredData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="amount"
            nameKey="month"
            strokeWidth={0}
          >
            {filteredData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[data.findIndex(d => d.month === entry.month) % COLORS.length]}
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
            }}
            formatter={(value: number) => [
              value.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' }),
              'סכום'
            ]}
          />
          <Legend 
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ direction: 'rtl', fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
