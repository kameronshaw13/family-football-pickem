"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

function findPreviewTarget() {
  if (!document.querySelector(".test-mode-banner")) return null;

  const sideBetCenter = document.querySelector(".side-bet-center");
  if (!sideBetCenter) return null;

  const viewTrigger = sideBetCenter.querySelector<HTMLButtonElement>('button[aria-label="Choose side bet view"]');
  const selectedView = viewTrigger?.querySelector(".custom-select-label")?.textContent?.trim() || "";
  if (!selectedView.startsWith("For You")) return null;

  return sideBetCenter.querySelector<HTMLElement>(".side-bet-list");
}

export default function TestIncomingOfferPreview() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const updateTarget = () => setTarget(findPreviewTarget());
    updateTarget();

    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target) return;
    target.classList.add("test-has-incoming-preview");
    return () => target.classList.remove("test-has-incoming-preview");
  }, [target]);

  if (!target) return null;

  return createPortal(
    <article className="side-bet-card mode-received open test-incoming-side-bet" aria-label="Test incoming side bet offer">
      <div className="side-bet-offer-row">
        <img
          src="https://a.espncdn.com/i/teamlogos/ncaa/500/152.png"
          alt=""
          className="team-logo"
          width={34}
          height={34}
          loading="lazy"
          decoding="async"
        />
        <div className="side-bet-offer-copy">
          <strong>Virginia at NC State -10.5</strong>
          <p><span className="side-bet-response pending">Offered</span> Test Player Virginia +10.5 · Sat 2:30 PM</p>
        </div>
        <strong className="side-bet-offer-amount money-neutral">$20</strong>
      </div>
      <div className="actions">
        <button className="btn accept" type="button" aria-disabled="true" title="Test preview only" onClick={(event) => event.preventDefault()}>
          <Check size={15} /> Review &amp; accept
        </button>
        <button className="btn secondary" type="button" aria-disabled="true" title="Test preview only" onClick={(event) => event.preventDefault()}>
          <X size={15} /> Decline
        </button>
      </div>
    </article>,
    target
  );
}
