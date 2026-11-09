// Pure helpers for the code examples: line handling, step edits and line marks.

export function sourceLines(source){
  const lines=String(source).split('\n');
  if(lines.at(-1)==='')lines.pop();
  return lines;
}

// Each edit names one exact full line; it must match exactly once.
export function applyEdits(source,edits){
  const lines=String(source).split('\n');
  for(const edit of edits){
    const hits=[];lines.forEach((line,index)=>{if(line===edit.from)hits.push(index);});
    if(hits.length!==1)throw Error('Edit must match exactly one line: '+edit.from.trim());
    lines[hits[0]]=edit.to;
  }
  return lines.join('\n');
}

export function findExample(code,id){return code.examples.find(example=>example.id===id)||null;}
export function findStage(example,id){return example?.stages.find(stage=>stage.id===id)||null;}

// Marks carry a 1-based line plus the text that line contains. When the two
// disagree (data edited later), the text wins; an unresolvable mark is dropped.
export function resolveMarks(source,marks){
  const lines=sourceLines(source);
  return marks.map(mark=>{
    let index=mark.line-1;
    if(!(lines[index]??'').includes(mark.contains))index=lines.findIndex(line=>line.includes(mark.contains));
    return index<0?null:{...mark,line:index+1};
  }).filter(Boolean);
}

export function resolveFocus(source,focus){
  const lines=sourceLines(source);
  return focus.map(entry=>{const index=lines.findIndex(line=>line.includes(entry.contains));return index<0?null:{line:index+1,note:entry.note};}).filter(Boolean);
}

export function sameOutput(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((line,index)=>line===b[index]);}

// Replays the mechanics steps from the 'before' stage. Whenever a step names a
// stage, the replayed source must equal that stage exactly.
export function replaySteps(steps,code){
  const results=[];let current=null,exampleId=null;
  for(const step of steps){
    const ref=step.code;const example=findExample(code,ref.example);
    if(!example)throw Error('Unknown example '+ref.example);
    if(exampleId!==ref.example){exampleId=ref.example;current=findStage(example,'before')?.source??null;if(current===null)throw Error('Example has no before stage');}
    current=applyEdits(current,ref.edits);
    if(ref.stage!==null){
      const stage=findStage(example,ref.stage);if(!stage)throw Error('Unknown stage '+ref.stage);
      if(stage.source!==current)throw Error('Step '+step.n+' does not reproduce stage '+ref.stage);
    }
    results.push({n:step.n,source:current});
  }
  return results;
}
