'use client';

import type {ButtonHTMLAttributes,ReactNode} from 'react';
import Icon,{type IconName} from './Icon';

type SkeletonProps={className?:string;width?:string|number;height?:string|number;label?:string};

export function Skeleton({className='',width,height,label='Caricamento'}:SkeletonProps){
  return <span className={`ui-skeleton${className?` ${className}`:''}`} style={{width,height}} role="status" aria-label={label}><span className="sr-only">{label}</span></span>;
}

export function SkeletonRows({rows=4,className=''}:{rows?:number;className?:string}){
  return <div className={`ui-skeleton-rows${className?` ${className}`:''}`} role="status" aria-label="Caricamento contenuti">
    {Array.from({length:rows},(_,index)=><div className="ui-skeleton-row" key={index}><Skeleton className="ui-skeleton-avatar"/><span><Skeleton className="ui-skeleton-line wide"/><Skeleton className="ui-skeleton-line short"/></span><Skeleton className="ui-skeleton-amount"/></div>)}
  </div>;
}

type InlineErrorProps={message:string;onRetry?:()=>void;retryLabel?:string;className?:string};

export function InlineError({message,onRetry,retryLabel='Riprova',className=''}:InlineErrorProps){
  return <div className={`ui-inline-error${className?` ${className}`:''}`} role="alert"><span className="ui-feedback-icon" aria-hidden="true">!</span><p>{message}</p>{onRetry&&<button type="button" className="ui-inline-action" onClick={onRetry}>{retryLabel}</button>}</div>;
}

type EmptyStateProps={title:string;description?:string;icon?:IconName;action?:ReactNode;className?:string};

export function EmptyState({title,description,icon='category',action,className=''}:EmptyStateProps){
  return <section className={`ui-empty-state surface${className?` ${className}`:''}`}><span className="ui-empty-icon" aria-hidden="true"><Icon name={icon} size={24}/></span><b>{title}</b>{description&&<p>{description}</p>}{action&&<div className="ui-empty-action">{action}</div>}</section>;
}

type AsyncButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{busy?:boolean;busyLabel?:string;variant?:'primary'|'secondary'|'danger';children:ReactNode};

export function AsyncButton({busy=false,busyLabel='Attendi…',variant='primary',className='',disabled,children,...props}:AsyncButtonProps){
  return <button {...props} className={`async-button async-button-${variant}${className?` ${className}`:''}`} disabled={disabled||busy} aria-busy={busy}>{busy&&<span className="async-spinner" aria-hidden="true"/>}<span>{busy?busyLabel:children}</span></button>;
}
