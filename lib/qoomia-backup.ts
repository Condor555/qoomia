export const QOOMIA_BACKUP_FORMAT='qoomia-backup' as const;
export const QOOMIA_BACKUP_VERSION='4.2' as const;
export const MAX_BACKUP_BYTES=10*1024*1024;

export type BackupSpace={
  key:string;
  name:string;
  type:'personal'|'shared';
  accountName:string;
  categories:Array<Record<string,unknown>>;
  transactions:Array<Record<string,unknown>>;
  recurring:Array<Record<string,unknown>>;
  budgets:Array<Record<string,unknown>>;
  budgetMacros:Array<Record<string,unknown>>;
  macroAllocations:Array<Record<string,unknown>>;
  savingGoals:Array<Record<string,unknown>>;
  savingGoalContributions:Array<Record<string,unknown>>;
};

export type QoomiaBackup={
  format:typeof QOOMIA_BACKUP_FORMAT;
  version:typeof QOOMIA_BACKUP_VERSION;
  exportedAt:string;
  backupId:string;
  profile:{displayName:string;language:'it'|'en';email:string};
  spaces:BackupSpace[];
  excludedSharedSpaces:Array<{name:string;reason:string}>;
};

export function isQoomiaBackup(value:unknown):value is QoomiaBackup{
  if(!value||typeof value!=='object')return false;
  const item=value as Partial<QoomiaBackup>;
  return item.format===QOOMIA_BACKUP_FORMAT&&item.version===QOOMIA_BACKUP_VERSION&&typeof item.backupId==='string'&&Array.isArray(item.spaces)&&item.spaces.every(space=>space&&typeof space==='object'&&typeof space.name==='string'&&Array.isArray(space.categories)&&Array.isArray(space.transactions));
}

export function cleanText(value:unknown,max=240){return String(value??'').trim().slice(0,max)}
export function cleanNumber(value:unknown){const number=Number(value);return Number.isFinite(number)?number:0}
export function cleanDate(value:unknown){const text=String(value??'');return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:''}
