import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  action?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 sm:py-4 sticky top-14 lg:top-0 z-10">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-blue-600 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-600 dark:text-gray-300 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight">{title}</h1>
          {description && <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
