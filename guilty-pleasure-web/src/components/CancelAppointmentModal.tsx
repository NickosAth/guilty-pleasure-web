import { useState } from 'react';
import type { Appointment } from '../types';
import Modal from './Modal';

type CancellationScope = 'single' | 'from-selected' | 'all-future';

export default function CancelAppointmentModal({
  appointment,
  seriesAppointments,
  onClose,
  onConfirm,
}: {
  appointment: Appointment;
  seriesAppointments: Appointment[];
  onClose: () => void;
  onConfirm: (ids: string[]) => Promise<void>;
}) {
  const [scope, setScope] = useState<CancellationScope>('single');
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const hasSeries = Boolean(appointment.recurrenceId && seriesAppointments.length > 1);
  const futureAppointments = seriesAppointments.filter(
    (item) => item.status !== 'cancelled' && item.dateTime > now
  );
  const fromSelectedAppointments = futureAppointments.filter(
    (item) => item.dateTime >= appointment.dateTime
  );
  const selectedIsPast = appointment.dateTime <= now;

  const ids = !hasSeries || scope === 'single'
    ? [appointment.id]
    : scope === 'from-selected'
      ? fromSelectedAppointments.map((item) => item.id)
      : futureAppointments.map((item) => item.id);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(ids);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Ακύρωση ραντεβού" onClose={onClose}>
      <div className="cancel-series-form">
        {hasSeries ? (
          <>
            <p>Πώς θέλετε να διαχειριστείτε αυτή την επαναλαμβανόμενη σειρά;</p>
            <button
              type="button"
              className={`cancel-scope-option ${scope === 'single' ? 'selected' : ''}`}
              aria-pressed={scope === 'single'}
              onClick={() => setScope('single')}
            >
              <strong>Μόνο αυτό το ραντεβού</strong>
            </button>
            <button
              type="button"
              className={`cancel-scope-option ${scope === 'from-selected' ? 'selected' : ''}`}
              aria-pressed={scope === 'from-selected'}
              disabled={selectedIsPast}
              onClick={() => setScope('from-selected')}
            >
              <strong>Αυτό και τα επόμενα</strong>
              <small>{fromSelectedAppointments.length} μελλοντικά ραντεβού</small>
            </button>
            <button
              type="button"
              className={`cancel-scope-option ${scope === 'all-future' ? 'selected' : ''}`}
              aria-pressed={scope === 'all-future'}
              onClick={() => setScope('all-future')}
            >
              <strong>Όλα τα μελλοντικά της σειράς</strong>
              <small>{futureAppointments.length} μελλοντικά ραντεβού</small>
            </button>
            {selectedIsPast && (
              <small className="cancel-series-note">
                Για παλιό ραντεβού μπορεί να ακυρωθεί μόνο αυτό. Η διακοπή σειράς αφορά μελλοντικά ραντεβού.
              </small>
            )}
          </>
        ) : (
          <p>Να ακυρωθεί αυτό το ραντεβού;</p>
        )}

        <div className="modal-actions">
          <button className="secondary" onClick={onClose} disabled={busy}>
            Πίσω
          </button>
          <button className="danger-outline" onClick={confirm} disabled={busy || !ids.length}>
            {busy ? <span className="spinner dark" /> : 'Επιβεβαίωση ακύρωσης'}
          </button>
        </div>
      </div>
    </Modal>
  );
}