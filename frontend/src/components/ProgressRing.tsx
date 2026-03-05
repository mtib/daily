import type { FC } from "react";

interface Props {
  completed: number;
  total: number;
  size?: number;
}

export const ProgressRing: FC<Props> = ({ completed, total, size = 36 }) => {
  if (total === 0) return null;

  const pct = total > 0 ? completed / total : 0;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const isDone = completed >= total;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`${completed} of ${total} tasks complete`}
      style={{ flexShrink: 0 }}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth="3"
      />
      {/* Progress arc */}
      {completed > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDone ? "var(--success)" : "var(--today-accent)"}
          strokeWidth="3"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${offset}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      )}
      {/* Label */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fill={isDone ? "var(--success)" : "var(--muted)"}
        fontWeight="600"
      >
        {completed}/{total}
      </text>
    </svg>
  );
};
