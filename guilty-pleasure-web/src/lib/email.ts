import {auth} from './firebase';

type NotificationAction='admin-rescheduled'|'admin-cancelled'|'user-cancelled';

type AppointmentReference={id:string};

async function notify(action:NotificationAction,appointment:AppointmentReference){
  const user=auth.currentUser;
  if(!user)throw new Error('You must be signed in to send a notification.');

  const token=await user.getIdToken();
  const response=await fetch('/.netlify/functions/send-notification',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
    body:JSON.stringify({action,appointmentId:appointment.id}),
  });

  if(!response.ok)throw new Error('Notification request was rejected.');
}

export async function cancellationEmail(_email:string,_username:string,appointment:AppointmentReference,_admin:boolean){
  await notify('admin-cancelled',appointment);
}

export async function adminCancellationEmail(appointment:AppointmentReference){
  await notify('user-cancelled',appointment);
}

export async function rescheduledEmail(_email:string,_username:string,appointment:AppointmentReference){
  await notify('admin-rescheduled',appointment);
}
