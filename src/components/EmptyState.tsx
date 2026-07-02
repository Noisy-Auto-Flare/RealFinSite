import Link from "next/link";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-slide-up">
      <span className="text-5xl mb-4 block">{icon}</span>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-6">
        {description}
      </p>
      {action && (
        action.href ? (
          <Link href={action.href} className="btn btn-primary">
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className="btn btn-primary">
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
