import {useEffect,useState} from 'react';
import {CalendarClock,Edit3,Trash2,XCircle} from 'lucide-react';
import {auth,cancelAppointments,loadAppointments,loadSlots,saveAppointments} from '../lib/api';
import {SERVICES,availableTimes} from '../lib/services';
import type {Appointment,BookedSlot} from '../types';
import Modal from './Modal';
import Calendar from './Calendar';
import Dropdown from './Dropdown';
import {adminCancellationEmail,cancellationEmail,rescheduledEmail,seriesCancellationEmail} from '../lib/email';
import CancelAppointmentModal from './CancelAppointmentModal';

export default function History({isAdmin,onClose,onChanged}:{isAdmin:boolean;onClose:()=>void;onChanged:()=>void}){
  const [items,setItems]=useState<Appointment[]>([]);
  const [slots,setSlots]=useState<BookedSlot[]>([]);
  const [edit,setEdit]=useState<Appointment|null>(null);
  const [cancelling,setCancelling]=useState<Appointment|null>(null);
  const refresh=async()=>{
    const [appointments,bookedSlots]=await Promise.all([loadAppointments(isAdmin?null:auth.currentUser?.uid),loadSlots()]);
    setItems(appointments);
    setSlots(bookedSlots);
  };

  useEffect(()=>{refresh()},[]);

  const cancel=async(ids:string[])=>{
    const targets=items.filter(appointment=>ids.includes(appointment.id)&&appointment.status!=='cancelled');
    try{
      if(targets.length>1&&targets[0]?.recurrenceId)await seriesCancellationEmail(ids,isAdmin);
      else if(targets[0]&&isAdmin)await cancellationEmail('',targets[0].clientName,targets[0],true);
      else if(targets[0])await adminCancellationEmail(targets[0]);
    }catch{}
    await cancelAppointments(ids);
    setCancelling(null);
    await refresh();
    onChanged();
  };

  return <Modal title={isAdmin?'Όλα τα Ραντεβού':'Τα ραντεβού μου'} onClose={onClose} wide>
    <div className="history-list">
      {items.length ? items.map((appointment)=>{
        const canModify=isAdmin||appointment.dateTime>new Date();
        return <div className="history-card" key={appointment.id}>
          <div className="history-info">
            <strong>{appointment.clientName}</strong>
            <span className="service-badge" style={{background:SERVICES.find(service=>service.name===appointment.service)?.color||'#777'}}>{appointment.service}</span>
            {appointment.status==='cancelled'&&<span className="cancelled-status">Ακυρωμένο</span>}
            <small>{appointment.dateTime.toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {appointment.dateTime.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})} ({appointment.durationMinutes} λ)</small>
          </div>
          <div className="history-right">
            <strong>{appointment.price.toFixed(2)} €</strong>
            {appointment.status==='cancelled' ? null : canModify ? <div>
              <button title="Αλλαγή ώρας" onClick={()=>setEdit(appointment)}><Edit3/></button>
              <button className="red" title="Ακύρωση" onClick={()=>setCancelling(appointment)}><XCircle/></button>
            </div> : <button className="red" title="Ακύρωση από το ιστορικό" onClick={()=>setCancelling(appointment)}><Trash2/></button>}
          </div>
        </div>;
      }) : <div className="empty"><CalendarClock/><p>{isAdmin?'Δεν βρέθηκαν ραντεβού.':'Δεν έχετε ιστορικό ραντεβού.'}</p></div>}
    </div>
    {cancelling&&<CancelAppointmentModal appointment={cancelling} seriesAppointments={items.filter(appointment=>appointment.recurrenceId===cancelling.recurrenceId)} onClose={()=>setCancelling(null)} onConfirm={cancel}/>}
    {edit&&<EditAppointment appointment={edit} appointments={items} slots={slots} isAdmin={isAdmin} onClose={()=>setEdit(null)} onSaved={async()=>{setEdit(null);await refresh();onChanged()}}/>}
  </Modal>;
}

export function EditAppointment({
  appointment,
  appointments,
  slots,
  isAdmin,
  onClose,
  onSaved,
}: {
  appointment: Appointment;
  appointments: Appointment[];
  slots: BookedSlot[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(appointment.dateTime);

  const [time, setTime] = useState(
    appointment.dateTime.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  const [busy, setBusy] = useState(false);

  const times = availableTimes(
    date,
    appointment.durationMinutes,
    slots,
    appointments,
    isAdmin,
    appointment.id
  );

  const formatTime = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const changeDate = (nextDate: Date) => {
    const nextTimes = availableTimes(
      nextDate,
      appointment.durationMinutes,
      slots,
      appointments,
      isAdmin,
      appointment.id
    );

    setDate(nextDate);

    // When changing to another day:
    // automatically select the FIRST available time.
    if (nextTimes.length > 0) {
      setTime(formatTime(nextTimes[0].h, nextTimes[0].m));
    } else {
      // No available times that day
      setTime('');
    }
  };

  const save = async () => {
    if (!time) return;

    setBusy(true);

    const [hours, minutes] = time.split(':').map(Number);

    const dateTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes
    );

    const updatedAppointment = {
      ...appointment,
      dateTime,
    };

    try {
      await saveAppointments([updatedAppointment]);

      if (isAdmin && updatedAppointment.ownerUid) {
        try {
          await rescheduledEmail(
            '',
            updatedAppointment.clientName,
            updatedAppointment
          );
        } catch {}
      }

      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const selectedService = SERVICES.find(
    service => service.name === appointment.service
  );

  return (
    <Modal title="Αλλαγή ραντεβού" onClose={onClose}>
      <div className="reschedule-header">
        <div>
          <span
            className="service-badge"
            style={{
              background: selectedService?.color || '#777',
            }}
          >
            {appointment.service}
          </span>

          <strong>{appointment.clientName}</strong>
        </div>

        <span>
          {appointment.durationMinutes} λεπτά ·{' '}
          {appointment.price.toFixed(2)} €
        </span>
      </div>

      <div className="reschedule-body">
        <section className="reschedule-section">
          <span className="reschedule-label">
            Νέα ημερομηνία
          </span>

          <Calendar
            value={date}
            onChange={changeDate}
            allowPast={isAdmin}
          />

          <div className="reschedule-date-preview">
            {date.toLocaleDateString('el-GR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
        </section>

        <section className="reschedule-section reschedule-time-section">
          <span className="reschedule-label">
            Διαθέσιμη ώρα
          </span>

          <Dropdown
            value={time}
            onChange={setTime}
            disabled={!times.length}
            options={times.map(item => {
              const value = formatTime(item.h, item.m);

              return {
                value,
                label: value,
              };
            })}
          />

          {!times.length && (
            <small className="availability-note">
              Δεν υπάρχουν διαθέσιμες ώρες για αυτήν την ημέρα.
            </small>
          )}
        </section>
      </div>

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
          disabled={!time || busy}
          onClick={save}
        >
          {busy ? (
            <span className="spinner dark" />
          ) : (
            'Αποθήκευση αλλαγών'
          )}
        </button>
      </div>
    </Modal>
  );
}