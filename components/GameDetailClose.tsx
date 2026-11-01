import { X } from "lucide-react";

/** One visible 28px close control with an invisible 44px touch target. */
export default function GameDetailClose({ onClose, label }: { onClose: () => void; label: string }) {
  return <button type="button" className="game-detail-close" onClick={onClose} aria-label={label}><X size={14} aria-hidden="true" /></button>;
}
