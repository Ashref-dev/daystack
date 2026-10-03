export function latestBy<T extends {id:string;updatedAt:number}>(rows:readonly T[],identity:(row:T)=>string=row=>row.id):T[]{
  const map=new Map<string,T>();
  for(const row of rows){const key=identity(row);const current=map.get(key);if(!current||row.updatedAt>current.updatedAt||(row.updatedAt===current.updatedAt&&JSON.stringify(row)>JSON.stringify(current)))map.set(key,row);}
  return [...map.values()];
}
