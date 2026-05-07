import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PayrollGridProps {
  takeHomePay: string;
  paymentPercentage: number;
}

export function PayrollGrid({ takeHomePay, paymentPercentage }: PayrollGridProps) {
  // Generate grid data - 7x7 grid with varying intensities
  const gridData = [
    [3, 3, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3, 3],
    [2, 3, 3, 3, 3, 3, 3],
    [2, 2, 3, 3, 3, 3, 3],
    [2, 2, 2, 3, 3, 3, 3],
    [1, 2, 2, 2, 3, 3, 3],
    [1, 1, 2, 2, 2, 3, 3],
  ];

  const getIntensityClass = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-primary/25';
      case 2:
        return 'bg-primary/55';
      case 3:
        return 'bg-primary';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className="card-elevated p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Payroll</h3>
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1 px-2">
          Monthly
          <ChevronDown className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Payroll Grid - Compact */}
      <div className="grid grid-cols-7 gap-[3px] flex-1 content-center">
        {gridData.map((row, rowIndex) => (
          row.map((intensity, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                'w-4 h-4 rounded-full transition-colors',
                getIntensityClass(intensity)
              )}
            />
          ))
        ))}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Take home pay</p>
          <p className="text-sm font-semibold">{takeHomePay}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Payment</p>
          <p className="text-sm font-semibold">{paymentPercentage}%</p>
        </div>
      </div>
    </div>
  );
}
