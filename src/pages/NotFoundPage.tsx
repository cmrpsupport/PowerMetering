import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="card p-6">
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Not found</div>
      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        That page doesn’t exist.
      </div>
      <div className="mt-4">
        <Link
          to="/"
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}

