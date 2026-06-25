import { ChevronDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AttendanceHeatmapProps {
  rate: number;
  trend: number;
}

export function AttendanceHeatmap({ rate, trend }: AttendanceHeatmapProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['17:00', '15:00', '13:00', '11:00', '09:00', '07:00'];

  // Mock heatmap data - intensity 0-3
  const heatmapData = [
    [1, 2, 2, 2, 3, 0, 0],
    [2, 3, 3, 3, 3, 1, 0],
    [2, 3, 3, 3, 3, 1, 1],
    [2, 2, 3, 3, 2, 0, 0],
    [1, 2, 2, 2, 2, 0, 0],
    [0, 1, 1, 1, 1, 0, 0],
  ];

  const getIntensityClass = (level: number) => {
    switch (level) {
      case 0:
        return 'bg-muted';
      case 1:
        return 'bg-muted-foreground/30';
      case 2:
        return 'bg-muted-foreground/60';
      case 3:
        return 'bg-foreground';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-xs">Attendance Overview</h3>
        <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground gap-0.5 px-1.5">
          This week
          <ChevronDown className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-lg font-display font-bold">{rate}%</span>
        <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
          <TrendingUp className="h-2 w-2" />
          {trend}%
        </span>
        <span className="text-[9px] text-muted-foreground">vs last week</span>
      </div>

      {/* Heatmap */}
      <div className="flex gap-1.5">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between py-0.5">
          {hours.map((hour) => (
            <span key={hour} className="text-[8px] text-muted-foreground leading-none">{hour}</span>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-7 gap-[2px]">
            {heatmapData.map((row, rowIndex) => (
              row.map((intensity, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={cn(
                    'h-4 rounded-sm transition-colors',
                    getIntensityClass(intensity)
                  )}
                />
              ))
            ))}
          </div>

          {/* X-axis labels */}
          <div className="grid grid-cols-7 gap-[2px] mt-1">
            {days.map((day) => (
              <span key={day} className="text-[8px] text-muted-foreground text-center">
                {day}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
