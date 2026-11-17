export function SaffronCut({ kind }: { kind: 'intact' | 'pieces' | 'style' }) {
  const paths = kind === 'pieces'
    ? ['M18 16 Q25 20 27 31', 'M33 36 Q37 41 37 48', 'M48 15 Q44 23 45 30', 'M58 37 Q53 43 52 51']
    : kind === 'style'
      ? ['M16 13 Q19 34 40 43', 'M40 10 L40 43', 'M64 13 Q61 34 40 43']
      : ['M15 12 Q28 25 27 51', 'M40 10 Q35 30 38 53', 'M65 12 Q51 28 53 51'];
  return (
    <div className="flex items-center gap-3 text-xs text-cream-400">
      <svg aria-hidden="true" viewBox="0 0 80 68" className="h-16 w-20 flex-shrink-0 rounded-xl bg-ink-900" fill="none" strokeLinecap="round">
        {kind === 'style' && <path d="M40 43 L40 59" stroke="#bc9648" strokeWidth="5" />}
        {paths.map(path => <path key={path} d={path} stroke="#c34052" strokeWidth="5" />)}
      </svg>
      <span>نمای شماتیک برش</span>
    </div>
  );
}
