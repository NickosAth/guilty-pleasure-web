import {useEffect} from 'react';
import type {ReactNode} from 'react';

let openModalCount=0;
let previousBodyOverflow='';

export default function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
	useEffect(()=>{
		if(openModalCount===0){
			previousBodyOverflow=document.body.style.overflow;
			document.body.style.overflow='hidden';
		}
		openModalCount+=1;
		return()=>{
			openModalCount-=1;
			if(openModalCount===0)document.body.style.overflow=previousBodyOverflow;
		};
	},[]);

	return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className={`modal ${wide?'modal-wide':''}`}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}>×</button></div>{children}</div></div>}
