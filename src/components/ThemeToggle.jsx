import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light',  Icon: Sun,     label: 'Light mode' },
  { value: 'dark',   Icon: Moon,    label: 'Dark mode' },
  { value: 'system', Icon: Monitor, label: 'System theme' },
];

export default function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn('flex items-center gap-0.5 rounded-[10px] bg-muted p-0.5', className)}>
      {OPTIONS.map(({ value, Icon, label }) => (
        <Toggle
          key={value}
          size="sm"
          className="h-7 min-w-7 rounded-lg px-1.5 text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm hover:bg-transparent"
          pressed={theme === value}
          onPressedChange={() => setTheme(value)}
          aria-label={label}
        >
          <Icon />
        </Toggle>
      ))}
    </div>
  );
}
