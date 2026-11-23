'use client';

import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';

type Trend={month:string;income:number;expense:number};
type Props={data:Trend[];currency:(value:number)=>string;localeTag:string;incomeLabel:string;expenseLabel:string};

export default function HomeTrendChart({data,currency,localeTag,incomeLabel,expenseLabel}:Props){
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:8,right:8,left:-22,bottom:0}}><CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="month" tickFormatter={value=>new Intl.DateTimeFormat(localeTag,{month:'short'}).format(new Date(`${value}-01`))} axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip formatter={(value,name)=>[currency(Number(value)),name==='income'?incomeLabel:expenseLabel]}/><Line dataKey="income" stroke="#35c38f" strokeWidth={3} dot={{r:3}}/><Line dataKey="expense" stroke="#ef6469" strokeWidth={3} dot={{r:3}}/></LineChart></ResponsiveContainer>;
}
