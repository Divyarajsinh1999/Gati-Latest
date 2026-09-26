/**
 * THE EXIT DIALOG.
 *
 * Rendered only while it is being asked, so it costs nothing the rest of the
 * time. All the judgement about WHEN to ask lives in useExitConfirmation;
 * this file only presents the question.
 *
 * THE SECOND STATE IS THE POINT.
 *
 * When "Exit" cannot actually close the window — an ordinary browser tab,
 * which is the common case — the dialog does not silently do nothing and it
 * does not pretend. It replaces the question with a plain explanation of why
 * nothing happened and how to leave. A confirmation whose confirm button
 * appears broken is worse than no confirmation.
 */

import { useEffect, useRef } from 'react';
import { useExitConfirmation } from '../../navigation/useExitConfirmation.js';
import { Button } from '../primitives/index.jsx';

export function ExitConfirmation() {
  const { isAsking, closeFailed, canClose, stay, leave } = useExitConfirmation();
  const stayRef = useRef(null);

  useEffect(() => {
    if (!isAsking) return undefined;
    // Focus lands on STAY, never on the destructive action — an Enter press
    // already in flight must not exit the app.
    stayRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') stay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAsking, stay]);

  if (!isAsking) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-title"
      // Tapping the backdrop stays, matching the safe choice of the two.
      onClick={stay}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        padding: 'max(16px, var(--safe-left)) 16px max(16px, var(--safe-bottom))',
        background: 'rgba(6, 11, 18, 0.55)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 340,
          padding: 20,
          borderRadius: 14,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
        }}
      >
        <h2
          id="exit-title"
          style={{
            margin: '0 0 6px',
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--color-ink)',
          }}
        >
          {closeFailed ? 'Gati cannot close itself here' : 'Leave Gati?'}
        </h2>

        <p
          style={{
            margin: '0 0 18px',
            fontFamily: 'var(--font-display)',
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--color-ink-soft)',
          }}
        >
          {closeFailed
            ? 'A page can only close a window that it opened itself, so this tab has to be closed the same way you would close any other — or use your device’s home gesture. Nothing you have saved is affected.'
            : canClose
              ? 'You are at the start of the app, so going back again would close it.'
              : 'You are at the start of the app. Going back again leaves Gati — your saved positions stay on this device.'}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button ref={stayRef} variant={closeFailed ? 'primary' : 'secondary'} onClick={stay}>
            {closeFailed ? 'Stay in Gati' : 'No, stay'}
          </Button>
          {!closeFailed ? <Button onClick={leave}>Yes, exit</Button> : null}
        </div>
      </div>
    </div>
  );
}
