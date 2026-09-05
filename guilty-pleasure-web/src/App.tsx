import {useEffect,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {auth,signOut} from './lib/api';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Accounts from './components/Accounts';
import History from './components/History';
import './styles.css';

type Session={isAdmin:boolean;username:string};

export default function App(){
	const [session,setSession]=useState<Session|null>(null);
	const [overlay,setOverlay]=useState<'profile'|'accounts'|'history'|null>(null);
	const [dashboardVersion,setDashboardVersion]=useState(0);
	useEffect(()=>onAuthStateChanged(auth,async user=>{
		if(!user){setSession(null);return;}
		const isAdmin=user.email?.toLowerCase()==='admin@guiltypleasure.gr';
		if(user.emailVerified||isAdmin)setSession(current=>current||{isAdmin,username:user.email?.split('@')[0]||''});
	}),[]);
	if(!session)return <Auth onLogin={setSession}/>;
	return <><Dashboard key={dashboardVersion} {...session} onLogout={async()=>{await signOut(auth);setSession(null)}} onProfile={()=>setOverlay('profile')} onAccounts={()=>setOverlay('accounts')} onHistory={()=>setOverlay('history')}/>{overlay==='profile'&&<Profile username={session.username} isAdmin={session.isAdmin} onClose={()=>setOverlay(null)} onDeleted={()=>{setOverlay(null);setSession(null)}}/>}{overlay==='accounts'&&<Accounts onClose={()=>setOverlay(null)}/>} {overlay==='history'&&<History isAdmin={session.isAdmin} onClose={()=>setOverlay(null)} onChanged={()=>setDashboardVersion(version=>version+1)}/>}</>;
}
