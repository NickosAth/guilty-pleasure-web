import {useEffect,useState} from 'react';
import {CalendarDays,Clock3,Edit3,History,LogOut,UserRound,Plus,Scissors,Euro,ChevronRight,UsersRoundIcon,XCircle} from 'lucide-react';
import {auth,cancelAppointments,loadAppointments,loadSlots} from '../lib/api';
import {SERVICES} from '../lib/services';
import type {Appointment,BookedSlot} from '../types';
import Calendar from './Calendar';
import AppointmentModal from './AppointmentModal';
import Modal from './Modal';
import {EditAppointment} from './History';
import {adminCancellationEmail,cancellationEmail} from '../lib/email';
import {seriesCancellationEmail} from '../lib/email';
import CancelAppointmentModal from './CancelAppointmentModal';

function dayEq(a:Date,b:Date){return a.toDateString()===b.toDateString();}
function money(amount:number){return `${amount.toFixed(2)} €`;}

type DashboardProps={
  isAdmin:boolean;
  username:string;
  onLogout:()=>void;
  onProfile:()=>void;
  onAccounts:()=>void;
  onHistory:()=>void;
};

export default function Dashboard({isAdmin,username,onLogout,onProfile,onAccounts,onHistory}:DashboardProps){
  const [selected,setSelected]=useState(new Date());
  const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [slots,setSlots]=useState<BookedSlot[]>([]);
  const [showNew,setShowNew]=useState(false);
  const [selectedAppointment,setSelectedAppointment]=useState<Appointment|null>(null);
  const [cancellingAppointment,setCancellingAppointment]=useState<Appointment|null>(null);
  const [editingAppointment,setEditingAppointment]=useState<Appointment|null>(null);

  const refresh=async()=>{
    const [nextAppointments,nextSlots]=await Promise.all([
      loadAppointments(isAdmin?null:auth.currentUser?.uid),
      loadSlots(),
    ]);
    setAppointments(nextAppointments);
    setSlots(nextSlots);
  };

  useEffect(()=>{refresh();},[]);

  const dayAppointments=appointments
    .filter(appointment=>appointment.status!=='cancelled'&&dayEq(appointment.dateTime,selected)&&(isAdmin||appointment.ownerUid===auth.currentUser?.uid))
    .sort((a,b)=>a.dateTime.getTime()-b.dateTime.getTime());
  const revenue=(items:Appointment[])=>items.filter(appointment=>appointment.status!=='cancelled').reduce((total,appointment)=>total+appointment.price,0);
   const selectedDayRevenue=revenue(dayAppointments);
   const selectedMonthRevenue=revenue(appointments.filter(appointment=>appointment.dateTime.getMonth()===selected.getMonth()&&appointment.dateTime.getFullYear()===selected.getFullYear()));
   const selectedYearRevenue=revenue(appointments.filter(appointment=>appointment.dateTime.getFullYear()===selected.getFullYear()));
   const selectedDayLabel=selected.toLocaleDateString('el-GR',{day:'numeric',month:'long'});
   const selectedMonthLabel=selected.toLocaleDateString('el-GR',{month:'long',year:'numeric'});
  const tomorrow=new Date(Date.now()+86400000);
  const tomorrowCount=appointments.filter(appointment=>dayEq(appointment.dateTime,tomorrow)&&appointment.status!=='cancelled').length;
  const serviceColor=(name:string)=>SERVICES.find(service=>service.name===name)?.color||'#777';

  const add=(appointment:Appointment)=>{
    setAppointments(items=>[...items,appointment]);
    setSlots(items=>[...items,{id:appointment.id,startAt:appointment.dateTime,endAt:new Date(appointment.dateTime.getTime()+appointment.durationMinutes*60000)}]);
  };

  const cancelAppointment=async(ids:string[])=>{
    const targets=appointments.filter(appointment=>ids.includes(appointment.id)&&appointment.status!=='cancelled');
    try{
      if(targets.length>1&&targets[0]?.recurrenceId)await seriesCancellationEmail(ids,isAdmin);
      else if(targets[0]&&isAdmin)await cancellationEmail('',targets[0].clientName,targets[0],true);
      else if(targets[0])await adminCancellationEmail(targets[0]);
    }catch{}
    await cancelAppointments(ids);
    const cancelledIds=new Set(ids);
    setAppointments(items=>items.map(appointment=>cancelledIds.has(appointment.id)?{...appointment,status:'cancelled'}:appointment));
    setSlots(items=>items.filter(slot=>!cancelledIds.has(slot.id)));
    setCancellingAppointment(null);
    setSelectedAppointment(null);
    await refresh();
  };

  return <div className="app-shell">
    <header className="topbar">
      <div className="top-brand">
        <div className="mini-logo"><Scissors/></div>
        <div>
          <strong>{isAdmin?'Guilty Pleasure Admin':`Guilty Pleasure - ${username}`}</strong>
          <span>{isAdmin?'Διαχείριση καταστήματος':'Πίνακας ραντεβού'}</span>
        </div>
      </div>
      <nav>
        <button title={isAdmin?'Λογαριασμοί Χρηστών':'Το προφίλ μου'} onClick={isAdmin?onAccounts:onProfile}>{isAdmin?<UsersRoundIcon/>:<UserRound/>}</button>
        <button title={isAdmin?'Όλα τα Ραντεβού':'Τα ραντεβού μου'} onClick={onHistory}><History/></button>
        {isAdmin&&<button title="Το προφίλ μου" onClick={onProfile}><UserRound/></button>}
        <button className="logout" title="Αποσύνδεση" onClick={onLogout}><LogOut/></button>
      </nav>
    </header>

    <main className="dashboard">
      <div className="hero-row">
        <div>
          <span className="eyebrow">{isAdmin?'BARBERSHOP MANAGEMENT':'ΤΑ ΡΑΝΤΕΒΟΥ ΜΟΥ'}</span>
          <h1>Καλώς ήρθες, <em>{isAdmin?'Admin':username}</em></h1>
          <p>Διαχειρίσου τα ραντεβού σου γρήγορα και εύκολα.</p>
        </div>
        <button className="primary new-btn" onClick={()=>setShowNew(true)}><Plus/> Νέο Ραντεβού</button>
      </div>

      {isAdmin&&<div className="tomorrow"><CalendarDays/><span>Αυριανό πρόγραμμα</span><strong>{tomorrowCount} ραντεβού αύριο</strong></div>}

      <div className="dashboard-grid">
        <section className="panel calendar-panel"><Calendar value={selected} onChange={setSelected} allowPast={isAdmin}/></section>
        <section className="panel day-panel">
          <div className="section-title">
            <div><span className="eyebrow">ΕΠΙΛΕΓΜΕΝΗ ΗΜΕΡΑ</span><h2>{selected.toLocaleDateString('el-GR',{day:'numeric',month:'long',year:'numeric'})}</h2></div>
            {isAdmin&&<div className="day-revenue"><span>Τζίρος</span><strong>{money(revenue(dayAppointments))}</strong></div>}
          </div>
          {dayAppointments.length?<div className="appointments-list">{dayAppointments.map(appointment=><button type="button" className="appointment-card" style={{'--accent':serviceColor(appointment.service)} as React.CSSProperties} key={appointment.id} onClick={()=>setSelectedAppointment(appointment)}><div className="appt-main"><div className="appt-time"><Clock3/><strong>{appointment.dateTime.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})}</strong></div><div><h3>{appointment.clientName}</h3><span>{appointment.service} · {appointment.durationMinutes} λ</span></div></div><strong className="price">{money(appointment.price)}</strong></button>)}</div>:<div className="empty"><CalendarDays/><p>Δεν υπάρχουν ραντεβού για αυτήν την ημέρα.</p></div>}
        </section>
      </div>

      {isAdmin&&<section className="stats"><div><div><CalendarDays/><span>Τζίρος {selectedDayLabel}</span></div><strong>{money(selectedDayRevenue)}</strong></div><div><div><Euro/><span>Τζίρος {selectedMonthLabel}</span></div><strong>{money(selectedMonthRevenue)}</strong></div><div><div><ChevronRight/><span>Τζίρος {selected.getFullYear()}</span></div><strong>{money(selectedYearRevenue)}</strong></div></section>}

      <section className="service-strip"><span>Υπηρεσίες</span>{SERVICES.map(service=><div key={service.name}><i style={{background:service.color}}/><span>{service.name}</span><strong>{service.price}€</strong></div>)}</section>
    </main>

    {showNew&&<AppointmentModal date={selected} isAdmin={isAdmin} username={username} appointments={appointments} slots={slots} onClose={()=>setShowNew(false)} onSaved={add}/>} 
    {selectedAppointment&&<Modal title="Διαχείριση ραντεβού" onClose={()=>setSelectedAppointment(null)}><div className="appointment-actions"><div><span className="service-badge" style={{background:serviceColor(selectedAppointment.service)}}>{selectedAppointment.service}</span><h3>{selectedAppointment.clientName}</h3><p>{selectedAppointment.dateTime.toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long'})} · {selectedAppointment.dateTime.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})}</p></div><button className="secondary" onClick={()=>{setEditingAppointment(selectedAppointment);setSelectedAppointment(null);}}><Edit3/> Αλλαγή ραντεβού</button><button className="danger-outline" onClick={()=>{setCancellingAppointment(selectedAppointment);setSelectedAppointment(null);}}><XCircle/> Ακύρωση ραντεβού</button></div></Modal>}
    {cancellingAppointment&&<CancelAppointmentModal appointment={cancellingAppointment} seriesAppointments={appointments.filter(appointment=>appointment.recurrenceId===cancellingAppointment.recurrenceId)} onClose={()=>setCancellingAppointment(null)} onConfirm={cancelAppointment}/>}
    {editingAppointment&&<EditAppointment appointment={editingAppointment} appointments={appointments} slots={slots} isAdmin={isAdmin} onClose={()=>setEditingAppointment(null)} onSaved={async()=>{setEditingAppointment(null);await refresh();}}/>}
  </div>;
}
