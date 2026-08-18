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
  const [showConfirmation, setShowConfirmation] = useState(false);

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
    if (!target) setShowConfirmation(false);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    target.classList.add("test-has-incoming-preview");
    return () => target.classList.remove("test-has-incoming-preview");
  }, [target]);

  if (!target) return null;

  return createPortal(
    <>
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
            <strong>Virginia at NC State +10.5</strong>
            <p><span className="test-offer-sender">Test Player offered</span> · NC State +10.5 · Sat 2:30 PM</p>
          </div>
          <strong className="side-bet-offer-amount money-neutral">$20</strong>
        </div>
        <div className="actions">
          <button className="btn accept" type="button" onClick={() => setShowConfirmation(true)}>
            <Check size={15} /> Review &amp; accept
          </button>
          <button className="btn secondary side-bet-decline" type="button" title="Test preview only" onClick={(event) => event.preventDefault()}>
            <X size={15} /> Decline
          </button>
        </div>
      </article>

      {showConfirmation && <div className="confirmation-backdrop test-confirmation-backdrop" onClick={() => setShowConfirmation(false)}>
        <section className="confirmation-sheet received-review-enhanced" role="dialog" aria-modal="true" aria-labelledby="test-review-bet-title" onClick={(event) => event.stopPropagation()}>
          <div className="confirmation-heading"><h2 id="test-review-bet-title">Review Bet</h2></div>
          <div className="confirmation-amount-row"><span>Amount</span><strong>$20</strong></div>
          <div className="confirmation-matchup">
            <div className="confirmation-team-row">
              <span>You get</span>
              <img src="https://a.espncdn.com/i/teamlogos/ncaa/500/152.png" alt="" className="confirmation-team-logo" width={32} height={32} />
              <strong>NC State +10.5</strong>
            </div>
            <div className="confirmation-team-row">
              <span>Test Player gets</span>
              <img src="https://a.espncdn.com/i/teamlogos/ncaa/500/258.png" alt="" className="confirmation-team-logo" width={32} height={32} />
              <strong>Virginia -10.5</strong>
            </div>
          </div>
          <p className="confirmation-kickoff">Saturday, Sep 12 · 2:30 PM · Virginia at NC State</p>
          <div className="confirmation-actions">
            <button className="btn secondary" type="button" onClick={() => setShowConfirmation(false)}>Cancel</button>
            <button className="btn accept" type="button" title="Test preview only" onClick={() => setShowConfirmation(false)}><Check size={16} /> Accept bet</button>
          </div>
        </section>
      </div>}
    </>,
    target
  );
}
