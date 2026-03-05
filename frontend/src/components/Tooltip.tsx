import { useState, useRef, useCallback, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  label: string;
  children: ReactNode;
  placement?: "top" | "bottom";
}

export const Tooltip: FC<Props> = ({ label, children, placement = "top" }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setCoords({
      x: r.left + r.width / 2,
      y: placement === "top" ? r.top : r.bottom,
    });
    setVisible(true);
  }, [placement]);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <span ref={wrapRef} onMouseEnter={show} onMouseLeave={hide} onClick={hide} style={{ display: "inline-flex" }}>
      {children}
      {visible &&
        createPortal(
          <span
            style={{
              position: "fixed",
              left: coords.x,
              top: placement === "top" ? coords.y - 8 : coords.y + 8,
              transform:
                placement === "top"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)",
              background: "var(--fg)",
              color: "var(--bg)",
              fontSize: "12px",
              fontWeight: 500,
              padding: "4px 8px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 9999,
              lineHeight: 1.4,
            }}
          >
            {label}
            {/* Arrow */}
            <span
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                ...(placement === "top"
                  ? {
                      bottom: -5,
                      borderTop: "5px solid var(--fg)",
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                    }
                  : {
                      top: -5,
                      borderBottom: "5px solid var(--fg)",
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                    }),
                width: 0,
                height: 0,
                display: "block",
              }}
            />
          </span>,
          document.body
        )}
    </span>
  );
};
