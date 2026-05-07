import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  valueUnit?: string;
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, valueUnit, className }: MetricCardProps) {
  return (
    <div className={cn(
      'card-elevated p-4 animate-fade-in',
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <div className="icon-tile h-8 w-8 flex-shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
      </div>
      
      <div className="flex items-end justify-between gap-1">
        <div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-display font-bold">
              {value}
            </span>
            {valueUnit && (
              <span className="text-sm text-muted-foreground">{valueUnit}</span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        
        {trend && (
          <span className={cn(
            'text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full',
            trend.isPositive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
          )}>
            {trend.isPositive ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
