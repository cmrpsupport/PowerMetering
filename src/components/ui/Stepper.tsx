export function Stepper({
  steps,
  currentStep,
}: {
  steps: string[]
  currentStep: number
}) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const isCompleted = i < currentStep
        const isCurrent = i === currentStep
        const isLast = i === steps.length - 1

        return (
          <div key={label} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  'grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition-colors',
                  isCompleted
                    ? 'bg-indigo-600 text-white'
                    : isCurrent
                      ? 'border-2 border-indigo-600 bg-white text-indigo-600 dark:bg-slate-900'
                      : 'border-2 border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500',
                ].join(' ')}
              >
                {i + 1}
              </div>
              <span
                className={[
                  'mt-1.5 text-[11px] font-medium',
                  isCompleted || isCurrent
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-500',
                ].join(' ')}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={[
                  'mb-5 h-0.5 w-12 sm:w-16',
                  isCompleted
                    ? 'bg-indigo-600'
                    : 'bg-slate-300 dark:bg-slate-600',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
