'use client';

import {Bar,BarChart,Cell,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import CategoryColorIcon from './CategoryColorIcon';
import {categoryStyle} from '../lib/category-style';

type Category={name:string;value:number;icon?:string|null;color?:string|null};
type Trend={month:string;income:number;expense:number};

export function CategoryDonutChart({categories,currency}:{categories:Category[];currency:(value:number)=>string}){
  function label(props:any){
    const percent=Number(props.percent||0);if(percent<.075)return null;
    const name=String(props.name||props.payload?.name||'');const category=categories.find(item=>item.name===name);if(!category)return null;
    const angle=-Number(props.midAngle||0)*Math.PI/180;const radius=Number(props.outerRadius||0)+24;
    const x=Number(props.cx||0)+radius*Math.cos(angle),y=Number(props.cy||0)+radius*Math.sin(angle);
    const style=categoryStyle(category.name,{icon:category.icon||undefined,color:category.color||undefined});const anchor=x>Number(props.cx||0)?'start':'end';
    return <g className="donut-category-label"><circle cx={x} cy={y} r="14" fill="var(--surface)" stroke="var(--line)"/><foreignObject x={x-11} y={y-11} width="22" height="22"><span className="donut-category-icon"><CategoryColorIcon icon={style.icon} size={22}/></span></foreignObject><text x={anchor==='start'?x+17:x-17} y={y+4} textAnchor={anchor} fill="var(--muted)" fontSize="10" fontWeight="700">{Math.round(percent*100)}%</text></g>;
  }
  return <ResponsiveContainer><PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="68%" paddingAngle={2} labelLine={false} label={label}>{categories.map(category=><Cell key={category.name} fill={category.color||categoryStyle(category.name).color}/>)}</Pie><Tooltip formatter={value=>currency(Number(value))}/></PieChart></ResponsiveContainer>;
}

export function TrendBarChart({data,currency,incomeLabel,expenseLabel}:{data:Trend[];currency:(value:number)=>string;incomeLabel:string;expenseLabel:string}){
  return <ResponsiveContainer><BarChart data={data}><XAxis dataKey="month" tickFormatter={value=>String(value).slice(5)} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(value,name)=>[currency(Number(value)),String(name)]}/><Bar dataKey="income" name={incomeLabel} fill="var(--green)" radius={[5,5,0,0]}/><Bar dataKey="expense" name={expenseLabel} fill="var(--red)" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>;
}
