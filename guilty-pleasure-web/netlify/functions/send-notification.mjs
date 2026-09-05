import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

const adminEmail='admin@guiltypleasure.gr';

function json(status,body){
  return {statusCode:status,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
}

function adminApp(){
  if(getApps().length)return getApps()[0];
  const encoded=process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if(!encoded)throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64.');
  return initializeApp({credential:cert(JSON.parse(Buffer.from(encoded,'base64').toString('utf8')))});
}

function appointmentText(appointment){
  const date=new Date(appointment.dateTime);
  return {
    service:String(appointment.service||''),
    appointment_date:date.toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),
    appointment_time:date.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'}),
  };
}

async function sendEmail(params){
  const serviceId=process.env.EMAILJS_SERVICE_ID;
  const templateId=process.env.EMAILJS_TEMPLATE_ID;
  const publicKey=process.env.EMAILJS_PUBLIC_KEY;
  const privateKey=process.env.EMAILJS_PRIVATE_KEY;
  if(!serviceId||!templateId||!publicKey||!privateKey)throw new Error('Notification service is not configured.');

  const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({service_id:serviceId,template_id:templateId,user_id:publicKey,accessToken:privateKey,template_params:params}),
  });
  if(!response.ok)throw new Error(`Email provider rejected the request (${response.status}).`);
}

export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});

  try{
    const token=event.headers.authorization?.replace(/^Bearer\s+/i,'');
    if(!token)return json(401,{error:'Authentication required.'});

    const app=adminApp();
    const decoded=await getAuth(app).verifyIdToken(token);
    const {action,appointmentId}=JSON.parse(event.body||'{}');
    if(!['admin-rescheduled','admin-cancelled','user-cancelled'].includes(action)||typeof appointmentId!=='string'){
      return json(400,{error:'Invalid notification request.'});
    }

    const db=getFirestore(app);
    const appointmentDoc=await db.collection('appointments').doc(appointmentId).get();
    if(!appointmentDoc.exists)return json(404,{error:'Appointment not found.'});
    const appointment=appointmentDoc.data();
    const isAdmin=decoded.email?.toLowerCase()===adminEmail;
    const ownsAppointment=appointment.ownerUid===decoded.uid;

    if((action.startsWith('admin-')&&!isAdmin)||(action==='user-cancelled'&&!ownsAppointment)){
      return json(403,{error:'Not allowed.'});
    }

    if(action==='user-cancelled'){
      await sendEmail({
        email:adminEmail,
        to_name:'Admin',
        notification_title:'Ακύρωση ραντεβού από πελάτη',
        notification_message:`Ο πελάτης ${appointment.clientName} ακύρωσε το ραντεβού του.`,
        client_name:String(appointment.clientName||''),
        ...appointmentText(appointment),
      });
      return json(200,{ok:true});
    }

    if(!appointment.ownerUid)return json(200,{ok:true,skipped:true});
    const profile=await db.collection('users').doc(appointment.ownerUid).get();
    const recipient=String(profile.data()?.email||'').trim().toLowerCase();
    if(!recipient)return json(200,{ok:true,skipped:true});

    const isRescheduled=action==='admin-rescheduled';
    await sendEmail({
      email:recipient,
      to_name:String(appointment.clientName||''),
      notification_title:isRescheduled?'Αλλαγή ραντεβού':'Ακύρωση ραντεβού',
      notification_message:isRescheduled?'Ο barber άλλαξε την ημερομηνία ή την ώρα του ραντεβού σας.':'Συγγνώμη, αλλά το ραντεβού σας ακυρώθηκε από τον διαχειριστή.',
      client_name:String(appointment.clientName||''),
      ...appointmentText(appointment),
    });
    return json(200,{ok:true});
  }catch(error){
    console.error('Notification failed:',error instanceof Error?error.message:'Unknown error');
    return json(500,{error:'Notification could not be sent.'});
  }
}
