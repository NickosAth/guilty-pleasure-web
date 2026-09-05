export type AppointmentStatus = 'upcoming' | 'cancelled';
export interface Appointment { id:string; clientName:string; ownerUid?:string|null; service:string; dateTime:Date; price:number; durationMinutes:number; status:AppointmentStatus; }
export interface BookedSlot { id:string; startAt:Date; endAt:Date; }
export interface ServiceOption { name:string; duration:number; price:number; color:string; }
export interface UserProfile { uid:string; username:string; email:string; }
