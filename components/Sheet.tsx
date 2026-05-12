"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] w-full max-w-xl overflow-hidden rounded-t-[28px] bg-[var(--color-surface)] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.4)]"
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="cursor-grab touch-none select-none active:cursor-grabbing"
            >
              <div className="flex items-center justify-between px-5 pt-4">
                <div className="mx-auto h-1.5 w-10 rounded-full bg-[var(--color-line)]" />
              </div>
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <h2 className="text-base font-medium">{title}</h2>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-full p-1.5 text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)]"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="no-scrollbar max-h-[78dvh] overflow-y-auto overflow-x-hidden px-5 pb-2">
              {children}
            </div>
            {footer && (
              <div className="border-t border-[var(--color-line)] px-5 py-3 safe-bottom">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
