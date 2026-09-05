import {useState} from 'react';
import {Scissors,Eye,EyeOff,UserPlus,Mail,Lock,UserRound} from 'lucide-react';
import {login,register,resetPassword} from '../lib/api';

function authErrorMessage(error: unknown) {
	const code = typeof error === 'object' && error !== null && 'code' in error
		? String((error as {code?: unknown}).code)
		: error instanceof Error
			? error.message
			: String(error);

	switch (code) {
		case 'unverified': return 'Πρέπει να επιβεβαιώσετε το email σας πριν συνδεθείτε.';
		case 'username-already-in-use': return 'Το username χρησιμοποιείται ήδη.';
		case 'auth/email-already-in-use':
		case 'email-already-in-use': return 'Το email χρησιμοποιείται ήδη.';
		case 'auth/weak-password':
		case 'weak-password': return 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.';
		case 'auth/invalid-email': return 'Ελέγξτε ότι το email είναι έγκυρο.';
		case 'auth/too-many-requests': return 'Έγιναν πολλές προσπάθειες. Δοκιμάστε ξανά αργότερα.';
		case 'permission-denied': return 'Το Firebase απέρριψε την αποθήκευση του προφίλ. Ελέγξτε τα Firestore Rules.';
		case 'unavailable': return 'Το Firestore δεν είναι διαθέσιμο. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.';
		default: return 'Ο χρήστης δεν βρέθηκε ή ο κωδικός είναι λάθος.';
	}
}

export default function Auth({onLogin}:{onLogin:(x:{isAdmin:boolean;username:string})=>void}) {
	const [mode,setMode]=useState<'login'|'register'>('login');
	const [username,setUsername]=useState('');
	const [email,setEmail]=useState('');
	const [password,setPassword]=useState('');
	const [show,setShow]=useState(false);
	const [busy,setBusy]=useState(false);
	const [msg,setMsg]=useState<{text:string;error?:boolean}|null>(null);

	const changeMode=(nextMode:'login'|'register')=>{
		setMode(nextMode);
		setMsg(null);
		setUsername('');
		setEmail('');
		setPassword('');
		setShow(false);
	};

	const submit=async()=>{
		setMsg(null);
		if(!username.trim()||!password.trim()||(mode==='register'&&!email.includes('@'))){
			setMsg({text:mode==='login'?'Παρακαλώ εισάγετε όνομα χρήστη και κωδικό.':'Παρακαλώ συμπληρώστε έγκυρο username, email και κωδικό.',error:true});
			return;
		}
		if(mode==='register'&&password.length<6){
			setMsg({text:'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.',error:true});
			return;
		}
		setBusy(true);
		try{
			if(mode==='login'){
				const result=await login(username,password);
				onLogin(result);
			}else{
				await register(username,email,password);
				setMsg({text:`Σας στάλθηκε email επιβεβαίωσης στο ${email}. Ανοίξτε το link και μετά συνδεθείτε.`});
				setMode('login');
				setEmail('');
				setPassword('');
			}
		}catch(error){
			setMsg({error:true,text:authErrorMessage(error)});
		}finally{
			setBusy(false);
		}
	};

	const reset=async()=>{
		if(!username.trim()){
			setMsg({text:'Εισάγετε πρώτα το email ή username σας.',error:true});
			return;
		}
		try{
			const resolvedEmail=await resetPassword(username);
			setMsg({text:`Στάλθηκε νέο email επαναφοράς στο ${resolvedEmail}.`});
		}catch{
			setMsg({text:'Δεν βρέθηκε λογαριασμός με αυτό το email ή username.',error:true});
		}
	};

	return <main className="auth-page"><div className="auth-glow"/><section className="auth-card"><div className="brand"><div className="brand-icon"><Scissors/></div><h1>Guilty Pleasure</h1><p>{mode==='login'?'Σύνδεση στον λογαριασμό σας':'Εγγραφείτε για να κλείνετε ραντεβού'}</p></div><div className="auth-switch" role="tablist" aria-label="Επιλογή σύνδεσης"><button type="button" role="tab" aria-selected={mode==='login'} className={mode==='login'?'active':''} onClick={()=>changeMode('login')}>Σύνδεση</button><button type="button" role="tab" aria-selected={mode==='register'} className={mode==='register'?'active':''} onClick={()=>changeMode('register')}>Εγγραφή</button></div>{msg&&<div className={`notice ${msg.error?'error':'success'}`}>{msg.text}</div>}<div className="form-card">{mode==='register'&&<label><span>Όνομα Χρήστη</span><div className="input-wrap"><UserRound/><input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username"/></div></label>}{mode==='login'&&<label><span>Όνομα Χρήστη / Email</span><div className="input-wrap"><UserRound/><input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username ή email"/></div></label>}{mode==='register'&&<label><span>Email</span><div className="input-wrap"><Mail/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div></label>}<label><span>Κωδικός</span><div className="input-wrap"><Lock/><input type={show?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/><button type="button" aria-label={show?'Απόκρυψη κωδικού':'Εμφάνιση κωδικού'} onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label><button className="primary" disabled={busy} onClick={submit}>{busy?<span className="spinner"/>:mode==='login'?'Σύνδεση':'Εγγραφή & Αποστολή OTP'}</button></div><div className="auth-actions">{mode==='login'&&<button className="link" onClick={reset}>Ξεχάσατε τον κωδικό σας;</button>}<button className="link accent" onClick={()=>changeMode(mode==='login'?'register':'login')}>{mode==='login'?<><UserPlus/> Δημιουργία λογαριασμού</>:'Έχετε ήδη λογαριασμό; Σύνδεση'}</button></div></section></main>}
