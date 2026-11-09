// Replaces {name} tokens; unknown tokens stay visible so a missing value is noticed.
export function fill(template,values={}){
  return String(template).replace(/\{([a-z]+)\}/gi,(whole,key)=>Object.hasOwn(values,key)?String(values[key]):whole);
}

export function formatTime(iso){
  const date=new Date(iso);
  if(!Number.isFinite(date.getTime()))return '';
  return date.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
}
