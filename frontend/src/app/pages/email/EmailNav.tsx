import { Link, useLocation } from 'react-router';

function navClass(active: boolean) {
  return [
    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
    active ? 'bg-[#0EA5E9] text-white' : 'bg-white text-[#1E3A5F] hover:bg-slate-100',
  ].join(' ');
}

export function EmailNav() {
  const location = useLocation();
  const inTemplates = location.pathname.startsWith('/email/templates');
  const inSequences = location.pathname.startsWith('/email/sequences') || location.pathname === '/email';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link to="/email/sequences" className={navClass(inSequences)}>
        Sequences
      </Link>
      <Link to="/email/templates" className={navClass(inTemplates)}>
        Templates
      </Link>
    </div>
  );
}
