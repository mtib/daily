import { useEffect, useRef, type FC } from "react";
import type { DayEntry } from "../types.js";
import { DayCard } from "./DayCard.js";

interface Props {
  days: DayEntry[];
  onToggle: (taskId: string, date: string, periodKey: string, currentlyComplete: boolean) => void;
  onSetCount: (taskId: string, date: string, periodKey: string, newCount: number) => void;
}

export const DayStrip: FC<Props> = ({ days, onToggle, onSetCount }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  const today = new Date().toISOString().substring(0, 10);

  // Center today's card on initial load
  useEffect(() => {
    if (scrolledRef.current || !containerRef.current || days.length === 0) return;
    const container = containerRef.current;
    const todayCard = container.querySelector<HTMLElement>(`[data-date="${today}"]`);
    if (todayCard) {
      const containerWidth = container.offsetWidth;
      const cardLeft = todayCard.offsetLeft;
      const cardWidth = todayCard.offsetWidth;
      container.scrollLeft = cardLeft - containerWidth / 2 + cardWidth / 2;
      scrolledRef.current = true;
    }
  }, [days, today]);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", overflow: "hidden" }}>
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "12px",
          overflowX: "auto",
          padding: "16px",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
          width: "100%",
          alignItems: "flex-start",
        }}
      >
        {days.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            isToday={day.date === today}
            onToggle={onToggle}
            onSetCount={onSetCount}
          />
        ))}
      </div>
    </div>
  );
};
