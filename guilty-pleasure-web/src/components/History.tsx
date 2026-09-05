import {useEffect,useState} from 'react';
import {CalendarClock,Edit3,Trash2,XCircle} from 'lucide-react';
import {auth,deleteAppointment,loadAppointments,loadSlots,saveAppointments} from '../lib/api';
import {SERVICES,availableTimes} from '../lib/services';
import type {Appointment,BookedSlot} from '../types';
import Modal from './Modal';
import Calendar from './Calendar';
import Dropdown from './Dropdown';
import {adminCancellationEmail,cancellationEmail,rescheduledEmail} from '../lib/email';

export default function History({isAdmin,onClose,onChanged}:{isAdmin:boolean;onClose:()=>void;onChanged:()=>void}){
  const [items,setItems]=useState<Appointment[]>([]);
  const [slots,setSlots]=useState<BookedSlot[]>([]);
  const [edit,setEdit]=useState<Appointment|null>(null);
  const refresh=async()=>{
    const [appointments,bookedSlots]=await Promise.all([loadAppointments(isAdmin?null:auth.currentUser?.uid),loadSlots()]);
    setItems(appointments);
    setSlots(bookedSlots);
  };

  useEffect(()=>{refresh()},[]);

  const cancel=async(appointment:Appointment)=>{
    if(!confirm('Θέλετε σίγουρα να ακυρώσετε αυτό το ραντεβού;'))return;
    try{
      if(isAdmin)await cancellationEmail('',appointment.clientName,appointment,true);
      if(!isAdmin)await adminCancellationEmail(appointment);
    }catch{}
    await deleteAppointment(appointment.id);
    await refresh();
    onChanged();
  };

  return <Modal title={isAdmin?'Όλα τα Ραντεβού':'Τα ραντεβού μου'} onClose={onClose} wide>
    <div className="history-list">
      {items.length ? items.map((appointment)=>{
        const canModify=appointment.dateTime>new Date();
        return <div className="history-card" key={appointment.id}>
          <div className="history-info">
            <strong>{appointment.clientName}</strong>
            <span className="service-badge" style={{background:SERVICES.find(service=>service.name===appointment.service)?.color||'#777'}}>{appointment.service}</span>
            <small>{appointment.dateTime.toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {appointment.dateTime.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})} ({appointment.durationMinutes} λ)</small>
          </div>
          <div className="history-right">
            <strong>{appointment.price.toFixed(2)} €</strong>
            {canModify ? <div>
              <button title="Αλλαγή ώρας" onClick={()=>setEdit(appointment)}><Edit3/></button>
              <button className="red" title="Ακύρωση" onClick={()=>cancel(appointment)}><XCircle/></button>
            </div> : <button className="red" title="Διαγραφή από το ιστορικό" onClick={()=>cancel(appointment)}><Trash2/></button>}
          </div>
        </div>;
      }) : <div className="empty"><CalendarClock/><p>{isAdmin?'Δεν βρέθηκαν ραντεβού.':'Δεν έχετε ιστορικό ραντεβού.'}</p></div>}
    </div>
    {edit&&<EditAppointment appointment={edit} appointments={items} slots={slots} isAdmin={isAdmin} onClose={()=>setEdit(null)} onSaved={async()=>{setEdit(null);await refresh();onChanged()}}/>}
  </Modal>;
}

function EditAppointment({appointment,appointments,slots,isAdmin,onClose,onSaved}:{appointment:Appointment;appointments:Appointment[];slots:BookedSlot[];isAdmin:boolean;onClose:()=>void;onSaved:()=>void}){
  const [date,setDate]=useState(appointment.dateTime);
  const [time,setTime]=useState(appointment.dateTime.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}));
  const [busy,setBusy]=useState(false);
  const times=availableTimes(date,appointment.durationMinutes,slots,appointments,false,appointment.id);

  const changeDate=(nextDate:Date)=>{
    const nextTimes=availableTimes(nextDate,appointment.durationMinutes,slots,appointments,false,appointment.id);
    setDate(nextDate);
    setTime(nextTimes.length?`${String(nextTimes[0].h).padStart(2,'0')}:${String(nextTimes[0].m).padStart(2,'0')}`:'');
  };

  useEffect(()=>{
    const selectedTimeIsAvailable=times.some(item=>`${String(item.h).padStart(2,'0')}:${String(item.m).padStart(2,'0')}`===time);
    if(!selectedTimeIsAvailable)setTime(times.length?`${String(times[0].h).padStart(2,'0')}:${String(times[0].m).padStart(2,'0')}`:'');
  },[date,times,time]);

  const save=async()=>{
    if(!time)return;
    setBusy(true);
    const [hours,minutes]=time.split(':').map(Number);
    const dateTime=new Date(date.getFullYear(),date.getMonth(),date.getDate(),hours,minutes);
    const updatedAppointment={...appointment,dateTime};
    try{
      await saveAppointments([updatedAppointment]);
      if(isAdmin&&updatedAppointment.ownerUid){
        try{
          await rescheduledEmail('',updatedAppointment.clientName,updatedAppointment);
        }catch{}
      }
      onSaved();
    }finally{
      setBusy(false);
    }
  };

  const selectedService=SERVICES.find(service=>service.name===appointment.service);
  return <Modal title="Αλλαγή ραντεβού" onClose={onClose}>
    <div className="reschedule-header">
      <div><span className="service-badge" style={{background:selectedService?.color||'#777'}}>{appointment.service}</span><strong>{appointment.clientName}</strong></div>
      <span>{appointment.durationMinutes} λεπτά · {appointment.price.toFixed(2)} €</span>
    </div>
    <div className="reschedule-body">
      <section className="reschedule-section">
        <span className="reschedule-label">Νέα ημερομηνία</span>
        <Calendar value={date} onChange={changeDate}/>
        <div className="reschedule-date-preview">{date.toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long'})}</div>
      </section>
      <section className="reschedule-section reschedule-time-section">
        <span className="reschedule-label">Διαθέσιμη ώρα</span>
        <Dropdown value={time} onChange={setTime} disabled={!times.length} options={times.map(item=>{const value=`${String(item.h).padStart(2,'0')}:${String(item.m).padStart(2,'0')}`;return {value,label:value}})}/>
        {!times.length&&<small className="availability-note">Δεν υπάρχουν διαθέσιμες ώρες για αυτήν την ημέρα.</small>}
      </section>
    </div>
    <div className="modal-actions">
      <button className="secondary" onClick={onClose} disabled={busy}>Ακύρωση</button>
      <button className="primary" disabled={!time||busy} onClick={save}>{busy?<span className="spinner dark"/>:'Αποθήκευση αλλαγών'}</button>
    </div>
  </Modal>;
}
