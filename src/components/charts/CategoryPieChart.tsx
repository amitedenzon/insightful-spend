import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CategoryPieChartProps {
  data: { name: string; value: number }[];
}

const COLORS = [
  'hsl(239, 84%, 67%)', // Primary
  'hsl(160, 84%, 39%)', // Success
  'hsl(350, 89%, 60%)', // Destructive
  'hsl(38, 92%, 50%)',  // Warning
  'hsl(280, 65%, 60%)', // Purple
  'hsl(200, 80%, 55%)', // Blue
  'hsl(239, 60%, 75%)', // Light Indigo
  'hsl(160, 60%, 55%)', // Light Emerald
  'hsl(350, 70%, 70%)', // Light Rose
  'hsl(38, 70%, 60%)',  // Light Amber
  'hsl(20, 80%, 60%)',  // Orange
  'hsl(180, 70%, 45%)', // Teal
];

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

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
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            strokeWidth={0}
          >
            {data.map((_, index) => (
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
            formatter={(value: number, name: string) => [
              value.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' }),
              name
            ]}
          />
          <Legend 
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ direction: 'rtl', fontSize: '12px', paddingTop: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
