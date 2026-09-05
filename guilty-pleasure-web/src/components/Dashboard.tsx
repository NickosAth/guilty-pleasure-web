import {useEffect,useState} from 'react';
import {CalendarDays,Clock3,History,LogOut,UserRound,Plus,Scissors,Euro,ChevronRight,UsersRoundIcon} from 'lucide-react';
import {auth,loadAppointments,loadSlots} from '../lib/api';
import {SERVICES} from '../lib/services';
import type {Appointment,BookedSlot} from '../types';
import Calendar from './Calendar';
import AppointmentModal from './AppointmentModal';

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
    .filter(appointment=>dayEq(appointment.dateTime,selected)&&(isAdmin||appointment.ownerUid===auth.currentUser?.uid))
    .sort((a,b)=>a.dateTime.getTime()-b.dateTime.getTime());
  const revenue=(items:Appointment[])=>items.filter(appointment=>appointment.status!=='cancelled').reduce((total,appointment)=>total+appointment.price,0);
  const today=revenue(appointments.filter(appointment=>dayEq(appointment.dateTime,new Date())));
  const month=revenue(appointments.filter(appointment=>appointment.dateTime.getMonth()===new Date().getMonth()&&appointment.dateTime.getFullYear()===new Date().getFullYear()));
  const year=revenue(appointments.filter(appointment=>appointment.dateTime.getFullYear()===new Date().getFullYear()));
  const tomorrow=new Date(Date.now()+86400000);
  const tomorrowCount=appointments.filter(appointment=>dayEq(appointment.dateTime,tomorrow)&&appointment.status!=='cancelled').length;
  const serviceColor=(name:string)=>SERVICES.find(service=>service.name===name)?.color||'#777';

  const add=(appointment:Appointment)=>{
    setAppointments(items=>[...items,appointment]);
    setSlots(items=>[...items,{id:appointment.id,startAt:appointment.dateTime,endAt:new Date(appointment.dateTime.getTime()+appointment.durationMinutes*60000)}]);
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
        <section className="panel calendar-panel"><Calendar value={selected} onChange={setSelected}/></section>
        <section className="panel day-panel">
          <div className="section-title">
            <div><span className="eyebrow">ΕΠΙΛΕΓΜΕΝΗ ΗΜΕΡΑ</span><h2>{selected.toLocaleDateString('el-GR',{day:'numeric',month:'long',year:'numeric'})}</h2></div>
            {isAdmin&&<div className="day-revenue"><span>Τζίρος</span><strong>{money(revenue(dayAppointments))}</strong></div>}
          </div>
          {dayAppointments.length?<div className="appointments-list">{dayAppointments.map(appointment=><div className="appointment-card" style={{'--accent':serviceColor(appointment.service)} as React.CSSProperties} key={appointment.id}><div className="appt-main"><div className="appt-time"><Clock3/><strong>{appointment.dateTime.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})}</strong></div><div><h3>{appointment.clientName}</h3><span>{appointment.service} · {appointment.durationMinutes} λ</span></div></div><strong className="price">{money(appointment.price)}</strong></div>)}</div>:<div className="empty"><CalendarDays/><p>Δεν υπάρχουν ραντεβού για αυτήν την ημέρα.</p></div>}
        </section>
      </div>

      {isAdmin&&<section className="stats"><div><div><CalendarDays/><span>Σημερινός Τζίρος</span></div><strong>{money(today)}</strong></div><div><div><Euro/><span>Τρέχων Μήνας</span></div><strong>{money(month)}</strong></div><div><div><ChevronRight/><span>Τρέχον Έτος</span></div><strong>{money(year)}</strong></div></section>}

      <section className="service-strip"><span>Υπηρεσίες</span>{SERVICES.map(service=><div key={service.name}><i style={{background:service.color}}/><span>{service.name}</span><strong>{service.price}€</strong></div>)}</section>
    </main>

    {showNew&&<AppointmentModal date={selected} isAdmin={isAdmin} username={username} appointments={appointments} slots={slots} onClose={()=>setShowNew(false)} onSaved={add}/>} 
  </div>;
}
