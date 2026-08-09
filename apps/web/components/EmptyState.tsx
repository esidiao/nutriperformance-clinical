import Link from 'next/link';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = '📋', title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* SVG illustration */}
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5 text-4xl shadow-inner" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">{description}</p>
      {actionLabel && (
        actionHref ? (
          <Link href={actionHref}>
            <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-xl transition-colors shadow-sm">
              {actionLabel}
            </button>
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
