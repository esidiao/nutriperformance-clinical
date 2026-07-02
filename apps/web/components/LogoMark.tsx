interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Marca visual da NutriPerformance: folha estilizada (nutrição) com linha de
 * precisão (clínico). Cores fixas de marca — independentes do tema.
 */
export function LogoMark({ size = 32, className = '' }: LogoMarkProps) {
  return (
    <div
      className={`rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #19917C 0%, #0D6B5A 100%)',
      }}
    >
      <svg
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        {/* Folha: ancora inferior-esquerda, arco até superior-direita */}
        <path
          d="M3.5 16.5 C3.5 9 9 3.5 16.5 3.5 C16.5 11 11 16.5 3.5 16.5 Z"
          fill="white"
        />
        {/* Nervura central — precisão clínica */}
        <line
          x1="16.5"
          y1="3.5"
          x2="6"
          y2="14"
          stroke="white"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeOpacity="0.38"
        />
      </svg>
    </div>
  );
}
