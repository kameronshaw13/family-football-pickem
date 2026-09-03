from pathlib import Path

path = Path("components/PickemAppBase.tsx")
text = path.read_text()

def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)

replace_once(
    '  const [savingBet, setSavingBet] = useState(false);\n  const [savingBetId, setSavingBetId] = useState<string | null>(null);\n',
    '',
    'remove root side bet saving state'
)

replace_once(
    '    sideBetMutationInFlightRef.current = true;\n    const requestId = ++sideBetRequestSequenceRef.current;\n    setSavingBet(true);\n    setSavingBetId(body.sideBetId || null);',
    '    if (sideBetMutationInFlightRef.current) return false;\n    sideBetMutationInFlightRef.current = true;\n    const requestId = ++sideBetRequestSequenceRef.current;',
    'guard mutation without root rerender'
)

replace_once(
    '      sideBetMutationInFlightRef.current = false;\n      setSavingBet(false);\n      setSavingBetId(null);',
    '      sideBetMutationInFlightRef.current = false;',
    'remove root saving cleanup'
)

replace_once(
    '          saving={savingBet}\n          savingBetId={savingBetId}\n',
    '',
    'remove saving props from SideBetCenter call'
)

replace_once(
    'function SideBetCenter({ view, setView, currentUser, profiles, sideBets, slotCounts, maxPerWeek, weekIsOpen, openGames, gameLeague, gameConference, selectedGame, selectedCreatorTeam, amount, recipients, saving, savingBetId, offerNotificationCount, setGame, setGameLeague, setGameConference, setCreatorTeam, setAmount, toggleRecipient, createBet, respond }: {',
    'function SideBetCenter({ view, setView, currentUser, profiles, sideBets, slotCounts, maxPerWeek, weekIsOpen, openGames, gameLeague, gameConference, selectedGame, selectedCreatorTeam, amount, recipients, offerNotificationCount, setGame, setGameLeague, setGameConference, setCreatorTeam, setAmount, toggleRecipient, createBet, respond }: {',
    'remove saving args from SideBetCenter signature'
)

replace_once(
    '  saving: boolean;\n  savingBetId: string | null;\n',
    '',
    'remove saving types from SideBetCenter'
)

replace_once(
    '  const [confirmingBetId, setConfirmingBetId] = useState<string | null>(null);\n  const [slipExpanded, setSlipExpanded] = useState(false);',
    '''  const [confirmingBetId, setConfirmingBetId] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<{ action: "create" | "accept" | "decline" | "cancel" | "clear"; sideBetId: string | null } | null>(null);
  const [optimisticActions, setOptimisticActions] = useState<Record<string, "accept" | "decline" | "cancel" | "clear">>({});
  const [slipExpanded, setSlipExpanded] = useState(false);''',
    'add local side bet mutation state'
)

replace_once(
    '  const slipClosingRef = useRef(false);\n  const received = sideBetsForView(sideBets, currentUser.id, "received");\n  const sent = sideBetsForView(sideBets, currentUser.id, "sent");',
    '''  const slipClosingRef = useRef(false);
  const saving = pendingMutation !== null;
  const savingBetId = pendingMutation?.sideBetId ?? null;
  const presentedSideBets: SideBet[] = sideBets.flatMap((bet): SideBet[] => {
    const action = optimisticActions[bet.id];
    if (!action) return [bet];
    if (action === "clear") return [];
    const nowIso = new Date().toISOString();
    if (action === "accept") {
      return [{
        ...bet,
        status: "accepted",
        accepted_by: currentUser.id,
        accepted_at: nowIso,
        updated_at: nowIso,
        accepted_by_profile: { id: currentUser.id, display_name: currentUser.display_name },
        targets: bet.targets?.map((target) => target.recipient_id === currentUser.id
          ? { ...target, response: "accepted", responded_at: nowIso }
          : target.response === "pending" ? { ...target, response: "closed", responded_at: nowIso } : target)
      }];
    }
    if (action === "decline") {
      const nextTargets = bet.targets?.map((target) => target.recipient_id === currentUser.id
        ? { ...target, response: "declined", responded_at: nowIso }
        : target);
      const stillPending = Boolean(nextTargets?.some((target) => target.response === "pending"));
      return [{ ...bet, status: stillPending ? bet.status : "declined", updated_at: nowIso, targets: nextTargets }];
    }
    return [{
      ...bet,
      status: "cancelled",
      updated_at: nowIso,
      targets: bet.targets?.map((target) => target.response === "pending" ? { ...target, response: "closed", responded_at: nowIso } : target)
    }];
  });
  const received = sideBetsForView(presentedSideBets, currentUser.id, "received");
  const sent = sideBetsForView(presentedSideBets, currentUser.id, "sent");''',
    'derive optimistic side bet presentation'
)

replace_once(
    '  const hasSlip = Boolean(selectedGame && selectedCreatorTeam);\n\n  const collapseSlip = useCallback(() => {',
    '''  const hasSlip = Boolean(selectedGame && selectedCreatorTeam);

  useEffect(() => {
    setOptimisticActions((current) => {
      let changed = false;
      const next = { ...current };
      for (const [sideBetId, action] of Object.entries(current)) {
        const bet = sideBets.find((item) => item.id === sideBetId);
        const target = bet?.targets?.find((item) => item.recipient_id === currentUser.id);
        const confirmed = !bet ||
          (action === "accept" && bet.status === "accepted" && bet.accepted_by === currentUser.id) ||
          (action === "decline" && (target?.response === "declined" || bet.status === "declined")) ||
          (action === "cancel" && bet.status === "cancelled") ||
          (action === "clear" && !bet);
        if (confirmed) {
          delete next[sideBetId];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [currentUser.id, sideBets]);

  const collapseSlip = useCallback(() => {''',
    'reconcile optimistic actions with server snapshot'
)

replace_once(
    '''  async function sendOffer() {
    const sentOffer = await createBet();
    if (sentOffer) setSlipExpanded(false);
  }

  async function acceptConfirmedBet() {
    if (!confirmingBetId) return;
    const sideBetId = confirmingBetId;
    setConfirmingBetId(null);
    const accepted = await respond("accept", sideBetId);
    if (!accepted) setConfirmingBetId(sideBetId);
  }''',
    '''  async function sendOffer() {
    if (pendingMutation) return;
    setPendingMutation({ action: "create", sideBetId: null });
    try {
      const sentOffer = await createBet();
      if (sentOffer) setSlipExpanded(false);
    } finally {
      setPendingMutation(null);
    }
  }

  async function runResponse(action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) {
    if (pendingMutation) return false;
    setPendingMutation({ action, sideBetId });
    setOptimisticActions((current) => ({ ...current, [sideBetId]: action }));
    try {
      const ok = await respond(action, sideBetId);
      if (!ok) {
        setOptimisticActions((current) => {
          const next = { ...current };
          delete next[sideBetId];
          return next;
        });
      }
      return ok;
    } finally {
      setPendingMutation(null);
    }
  }

  async function acceptConfirmedBet() {
    if (!confirmingBetId) return;
    const sideBetId = confirmingBetId;
    setConfirmingBetId(null);
    const accepted = await runResponse("accept", sideBetId);
    if (!accepted) setConfirmingBetId(sideBetId);
  }''',
    'local mutation runner and optimistic response'
)

replace_once(
    '{view === "offers" && <SideBetList bets={offers} currentUser={currentUser} empty="No side bet offers yet." saving={saving} savingBetId={savingBetId} canAccept={(bet) => weekIsOpen && hasAvailableSideBetSlot(sideBets, currentUser.id, bet.week, weeklyLimit, bet.id)} acceptDisabledText={!weekIsOpen ? "Opens Tue 8:00 AM" : "Limit reached"} requestAccept={setConfirmingBetId} respond={respond} />}',
    '{view === "offers" && <SideBetList bets={offers} currentUser={currentUser} empty="No side bet offers yet." saving={saving} savingBetId={savingBetId} canAccept={(bet) => weekIsOpen && hasAvailableSideBetSlot(presentedSideBets, currentUser.id, bet.week, weeklyLimit, bet.id)} acceptDisabledText={!weekIsOpen ? "Opens Tue 8:00 AM" : "Limit reached"} requestAccept={setConfirmingBetId} respond={runResponse} />}',
    'route offer actions through optimistic runner'
)

path.write_text(text)
