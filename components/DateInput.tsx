'use client';

import {useRef} from 'react';
import {CalendarBlank,CaretDown} from '@phosphor-icons/react';
import {useI18n} from './LanguageProvider';

type Props={
  value:string;
  onChange:(value:string)=>void;
  id?:string;
  disabled?:boolean;
  min?:string;
  max?:string;
  ariaLabel:string;
  className?:string;
};

/**
 * Controllo data Qoomia: conserva il date picker nativo (anche su iOS),
 * ma presenta un'unica superficie tappabile con icone Phosphor e valore leggibile.
 */
export default function DateInput({value,onChange,id,disabled=false,min,max,ariaLabel,className=''}:Props){
  const {date}=useI18n();
  const inputRef=useRef<HTMLInputElement|null>(null);
  const readable=value?date(value,{day:'2-digit',month:'short',year:'numeric'}):ariaLabel;

  function openPicker(){
    if(disabled)return;
    const input=inputRef.current;
    if(!input)return;
    input.focus({preventScroll:true});
    input.showPicker?.();
  }

  return <span className={`date-input-control${disabled?' is-disabled':''}${className?` ${className}`:''}`} onClick={openPicker}>
    <CalendarBlank className="date-input-leading" size={20} weight="regular" aria-hidden="true"/>
    <span className="date-input-value" aria-hidden="true">{readable}</span>
    <CaretDown className="date-input-chevron" size={16} weight="bold" aria-hidden="true"/>
    <input
      ref={inputRef}
      id={id}
      className="date-input-native"
      type="date"
      value={value}
      disabled={disabled}
      min={min}
      max={max}
      aria-label={ariaLabel}
      onClick={event=>{event.stopPropagation();event.currentTarget.showPicker?.()}}
      onChange={event=>onChange(event.target.value)}
    />
  </span>;
}
