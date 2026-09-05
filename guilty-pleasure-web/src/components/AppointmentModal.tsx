import { useEffect, useMemo, useState } from 'react';
import { auth, saveAppointments, slotAvailable, getUsers } from '../lib/api';
import { SERVICES, availableTimes } from '../lib/services';
import type { Appointment, BookedSlot, UserProfile } from '../types';
import Modal from './Modal';
import Dropdown from './Dropdown';
import Calendar from './Calendar';

type Props = {
  date: Date;
  isAdmin: boolean;
  username: string;
  appointments: Appointment[];
  slots: BookedSlot[];
  onClose: () => void;
  onSaved: (a: Appointment) => void;
};

export default function AppointmentModal({
  date,
  isAdmin,
  username,
  appointments,
  slots,
  onClose,
  onSaved,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(date);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [client, setClient] = useState(isAdmin ? '' : username);
  const [userUid, setUserUid] = useState<string | undefined>();
  const [serviceName, setServiceName] = useState(SERVICES[0]?.name ?? '');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const service = useMemo(
    () =>
      SERVICES.find((s) => s.name === serviceName) ??
      SERVICES[0],
    [serviceName]
  );

  useEffect(() => {
    if (!isAdmin) return;

    getUsers()
      .then(setUsers)
      .catch(() => {
        setError('Δεν ήταν δυνατή η φόρτωση των χρηστών.');
      });
  }, [isAdmin]);

  const times = useMemo(() => {
    if (!service) return [];

    return availableTimes(
      selectedDate,
      service.duration,
      slots,
      appointments,
      false
    );
  }, [selectedDate, service, slots, appointments]);

  useEffect(() => {
    const firstTime = times[0];

    if (!firstTime) {
      setTime('');
      return;
    }

    const formatted = `${String(firstTime.h).padStart(2, '0')}:${String(
      firstTime.m
    ).padStart(2, '0')}`;

    setTime(formatted);
  }, [times]);

  const handleServiceChange = (newServiceName: string) => {
    setError('');

    const exists = SERVICES.some(
      (s) => s.name === newServiceName
    );

    if (!exists) {
      setError('Η συγκεκριμένη υπηρεσία δεν είναι διαθέσιμη.');
      return;
    }

    setServiceName(newServiceName);
  };

  const handleClientChange = (value: string) => {
    setUserUid(value === 'new' ? undefined : value);

    if (value === 'new') {
      setClient('');
      return;
    }

    const selectedUser = users.find(
      (user) => user.uid === value
    );

    setClient(selectedUser?.username ?? '');
  };

  const submit = async () => {
    setError('');

    if (!client.trim()) {
      setError('Συμπληρώστε το όνομα του πελάτη.');
      return;
    }

    if (!service) {
      setError('Επιλέξτε μία υπηρεσία.');
      return;
    }

    if (!time) {
      setError('Επιλέξτε διαθέσιμη ώρα.');
      return;
    }

    if (!times.length) {
      setError('Δεν υπάρχει διαθέσιμη ώρα για αυτήν την ημέρα.');
      return;
    }

    setBusy(true);

    try {
      const [h, m] = time.split(':').map(Number);

      const dateTime = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        h,
        m,
        0,
        0
      );

      const available = await slotAvailable(
        dateTime,
        service.duration
      );

      if (!available) {
        setError(
          'Η ώρα μόλις κλείστηκε από άλλον χρήστη. Επιλέξτε άλλη διαθέσιμη ώρα.'
        );
        return;
      }

      const appointment: Appointment = {
        id: Date.now().toString(),
        clientName: client.trim(),
        ownerUid: isAdmin
          ? userUid ?? null
          : auth.currentUser?.uid ?? null,
        service: service.name,
        dateTime,
        price: service.price,
        durationMinutes: service.duration,
        status: 'upcoming',
      };

      await saveAppointments([appointment]);

      onSaved(appointment);
      onClose();
    } catch (error) {
      console.error('Appointment creation failed:', error);

      setError(
        'Παρουσιάστηκε πρόβλημα κατά την αποθήκευση του ραντεβού.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Νέο Ραντεβού" onClose={onClose}>
      <div className="modal-form">
        {isAdmin ? (
          <>
            <label>
              Πελάτης

              <Dropdown
                value={userUid ?? 'new'}
                onChange={handleClientChange}
                options={[
                  { value: 'new', label: 'Νέος πελάτης' },
                  ...users.map((user) => ({
                    value: user.uid,
                    label: `${user.username} (${user.email})`,
                  })),
                ]}
              />
            </label>

            <label>
              Όνομα νέου πελάτη

              <input
                disabled={!!userUid}
                value={client}
                onChange={(event) =>
                  setClient(event.target.value)
                }
              />
            </label>
          </>
        ) : (
          <label>
            Όνομα Χρήστη

            <input
              disabled
              value={client}
            />
          </label>
        )}

        <label>
          Υπηρεσία

          <Dropdown
            value={serviceName}
            onChange={handleServiceChange}
            options={SERVICES.map((item) => ({
              value: item.name,
              label: `${item.name} (${item.price}€)`,
            }))}
          />
        </label>

        <section className="appointment-date-picker">
          <span>Ημερομηνία ραντεβού</span>
          <Calendar value={selectedDate} onChange={setSelectedDate} />
          <strong>{selectedDate.toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long'})}</strong>
        </section>

        <label>
          Διαθέσιμη ώρα

          <Dropdown
            value={time}
            onChange={setTime}
            disabled={!times.length}
            options={times.map((t) => {
              const value = `${String(t.h).padStart(
                2,
                '0'
              )}:${String(t.m).padStart(2, '0')}`;

              return { value, label: value };
            })}
          />
        </label>

        {service && (
          <div className="service-summary">
            <span>
              {service.name}
            </span>

            <span>
              {service.duration} λεπτά · {service.price}€
            </span>
          </div>
        )}

        {error && (
          <div className="notice error">
            {error}
          </div>
        )}

        {!times.length && !error && (
          <div className="notice error">
            Δεν υπάρχει διαθέσιμη ώρα για αυτήν την ημέρα.
          </div>
        )}

        <div className="modal-actions">
          <button
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Ακύρωση
          </button>

          <button
            className="primary"
            disabled={
              busy ||
              !times.length ||
              !service ||
              !time ||
              !client.trim()
            }
            onClick={submit}
          >
            {busy ? (
              <span className="spinner dark" />
            ) : (
              'Αποθήκευση'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}