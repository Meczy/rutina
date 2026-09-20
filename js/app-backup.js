
const KEY="mi-rutina-datos-v1", DONE="mi-rutina-done-";
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function yt(url){const m=(url||"").match(/(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);return m?`https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1`:"";}
const seeds=Array.from(document.querySelectorAll("[data-seed-day]")).map(x=>JSON.parse(x.textContent));
let rutina=JSON.parse(localStorage.getItem(KEY)||"null")||seeds;

// Reparar números de días antiguos o inválidos (null/NaN).
const usados = new Set();
let siguiente = 1;
rutina.forEach(d => {
  const n = Number(d.numero);
  if(Number.isFinite(n) && n > 0 && !usados.has(n)){
    d.numero = n;
    usados.add(n);
  }else{
    while(usados.has(siguiente)) siguiente++;
    d.numero = siguiente++;
    usados.add(d.numero);
  }
});
localStorage.setItem(KEY,JSON.stringify(rutina));

const tabs=document.getElementById("tabs"),content=document.getElementById("content"),editor=document.getElementById("editor");
const modal=document.getElementById("modal"),modalBody=document.getElementById("modalBody"),modalTitle=document.getElementById("modalTitle"),editorList=document.getElementById("editorList");
const closeBtn=document.getElementById("close"), editorBtn=document.getElementById("editorButton"), closeEditorBtn=document.getElementById("closeEditor"), addDayBtn=document.getElementById("addDay"), exportDataBtn=document.getElementById("exportData"), resetDataBtn=document.getElementById("resetData"), exerciseFormEl=document.getElementById("exerciseForm"), formTitleEl=document.getElementById("formTitle"), exerciseNameEl=document.getElementById("exerciseName"), exerciseSeriesEl=document.getElementById("exerciseSeries"), exerciseRepsEl=document.getElementById("exerciseReps"), exerciseUrlEl=document.getElementById("exerciseUrl"), cancelExerciseBtn=document.getElementById("cancelExercise");

function save(){localStorage.setItem(KEY,JSON.stringify(rutina));}
function render(){
 tabs.innerHTML="";content.innerHTML="";
 totalDays.textContent=rutina.length;totalExercises.textContent=rutina.reduce((n,d)=>n+d.ejercicios.length,0);
 rutina.forEach((d,i)=>{
  const b=document.createElement("button");b.className="tab"+(i===0?" active":"");b.textContent="Día "+d.numero;b.onclick=()=>showDay(i);tabs.appendChild(b);
  const s=document.createElement("section");s.className="day"+(i===0?" active":"");
  s.innerHTML=`<div class="day-head"><h2>${esc(d.titulo)}</h2><span>${d.ejercicios.length} ejercicios</span></div>`;
  const list=document.createElement("div");list.className="exercise-list";
  d.ejercicios.forEach((e,j)=>{
   const done=localStorage.getItem(DONE+d.numero+"-"+j)==="1";
   const c=document.createElement("article");c.className="card"+(done?" done":"");
   const platform=/instagram\.com/i.test(e.url||"")?"instagram":"";
   c.innerHTML=`<div class="num">${j+1}</div><div><div class="name">${esc(e.name)}</div><div class="meta">${e.series?`<span class="pill">${esc(e.series)} series</span>`:""}${e.reps?`<span class="pill">${esc(e.reps)} reps</span>`:""}</div></div><div class="actions"><button class="play ${platform}" ${e.url?"":"disabled"}>${e.url?"▶ Ver video":"Sin enlace"}</button><input class="check" type="checkbox" ${done?"checked":""}></div>`;
   if(e.url)c.querySelector(".play").onclick=()=>openVideo(e);
   c.querySelector(".check").onchange=x=>{localStorage.setItem(DONE+d.numero+"-"+j,x.target.checked?"1":"0");c.classList.toggle("done",x.target.checked);};
   list.appendChild(c);
  });
  s.appendChild(list);content.appendChild(s);
 });
}
function showDay(i){document.querySelectorAll(".tab").forEach((x,j)=>x.classList.toggle("active",j===i));document.querySelectorAll(".day").forEach((x,j)=>x.classList.toggle("active",j===i));}
function openVideo(e){
 modalTitle.textContent=e.name;const u=e.embed||yt(e.url);
 modalBody.innerHTML=u?`<div class="video-frame"><iframe src="${esc(u)}" title="${esc(e.name)}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe></div>`:`<div class="fallback"><h3>Este video se abrirá en su plataforma original</h3><p>La plataforma puede bloquear la reproducción embebida.</p><a href="${esc(e.url)}" target="_blank">Abrir video</a></div>`;
 modal.classList.add("open");
}
function closeVideo(){modal.classList.remove("open");modalBody.innerHTML="";}
closeBtn.onclick=closeVideo;modal.addEventListener("click",e=>{if(e.target===modal)closeVideo()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeVideo()});

let selectedEditorDay = 0;

function renderEditor(){
  if(!rutina.length) return;
  if(selectedEditorDay >= rutina.length) selectedEditorDay = 0;

  const tabsBox=document.getElementById("editorTabs");
  tabsBox.innerHTML="";
  rutina.forEach((day,di)=>{
    const t=document.createElement("button");
    t.className="editor-tab"+(di===selectedEditorDay?" active":"");
    t.textContent="Día "+day.numero;
    t.onclick=()=>{selectedEditorDay=di;renderEditor();};
    tabsBox.appendChild(t);
  });

  const day=rutina[selectedEditorDay];
  editorList.innerHTML="";

  const heading=document.createElement("div");
  heading.className="editor-day-title";
  heading.innerHTML=`
    <div class="editor-day-main">
      <div class="day-number-edit"><label>Nº</label><input id="dayNumberInput" type="number" min="1" step="1" value="${Number(day.numero)||1}"></div>
      <div class="day-name-edit"><label>Nombre</label><input id="dayNameInput" value="${esc(day.titulo)}"></div>
      <button class="small save-day-name" id="saveDayBtn">💾 Guardar día</button>
    </div>
    <button class="small danger" id="deleteCurrentDayBtn">🗑️ Eliminar día</button>`;
  editorList.appendChild(heading);
  document.getElementById("saveDayBtn").onclick=()=>saveDaySettings(selectedEditorDay);
  document.getElementById("deleteCurrentDayBtn").onclick=()=>deleteDay(selectedEditorDay);

  const exerciseList=document.createElement("div");
  exerciseList.className="editor-exercise-list";

  day.ejercicios.forEach((ex,ei)=>{
    const row=document.createElement("div");
    row.className="edit-row draggable-exercise";
    row.draggable=true;
    row.dataset.index=String(ei);
    row.innerHTML=`
      <div class="drag-handle" title="Arrastra para cambiar el orden">⋮⋮</div>
      <div class="edit-row-info"><strong>${esc(ex.name)}</strong><div class="edit-meta">${esc(ex.series)} × ${esc(ex.reps)} · ${ex.url?"video agregado":"sin video"}</div></div>
      <div class="edit-actions">
        <button class="small move-up" title="Subir">↑</button>
        <button class="small move-down" title="Bajar">↓</button>
        <button class="small" data-edit="${ei}">✏️ Editar</button>
        <button class="small danger" data-delete="${ei}">🗑️</button>
      </div>`;

    row.querySelector('[data-edit]').onclick=()=>editExercise(selectedEditorDay,ei);
    row.querySelector('[data-delete]').onclick=()=>deleteExercise(selectedEditorDay,ei);
    row.querySelector('.move-up').onclick=()=>moveExercise(selectedEditorDay,ei,-1);
    row.querySelector('.move-down').onclick=()=>moveExercise(selectedEditorDay,ei,1);

    row.addEventListener('dragstart',ev=>{
      row.classList.add('dragging');
      ev.dataTransfer.effectAllowed='move';
      ev.dataTransfer.setData('text/plain',String(ei));
    });
    row.addEventListener('dragend',()=>{
      row.classList.remove('dragging');
      exerciseList.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    });
    row.addEventListener('dragover',ev=>{
      ev.preventDefault();
      const dragging=exerciseList.querySelector('.dragging');
      if(!dragging||dragging===row) return;
      row.classList.add('drag-over');
      const rect=row.getBoundingClientRect();
      const before=ev.clientY < rect.top+rect.height/2;
      exerciseList.insertBefore(dragging,before?row:row.nextSibling);
    });
    row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
    row.addEventListener('drop',ev=>{
      ev.preventDefault();
      row.classList.remove('drag-over');
      const order=[...exerciseList.querySelectorAll('.draggable-exercise')].map(r=>Number(r.dataset.index));
      if(order.length===day.ejercicios.length){
        day.ejercicios=order.map(n=>day.ejercicios[n]);
        save();render();renderEditor();
      }
    });
    exerciseList.appendChild(row);
  });
  editorList.appendChild(exerciseList);
  const add=document.createElement('button');
  add.className='add-btn';add.textContent='＋ Agregar ejercicio a este día';add.onclick=()=>editExercise(selectedEditorDay,-1);
  editorList.appendChild(add);
}

function moveExercise(di,ei,delta){
  const list=rutina[di].ejercicios;
  const target=ei+delta;
  if(target<0||target>=list.length) return;
  [list[ei],list[target]]=[list[target],list[ei]];
  save();render();renderEditor();
}
function saveDaySettings(di){
  const name=(document.getElementById('dayNameInput')?.value||'').trim();
  const number=Number(document.getElementById('dayNumberInput')?.value);
  if(!name){alert('Escribe un nombre para el día.');return;}
  if(!Number.isInteger(number)||number<1){alert('El número del día debe ser un entero mayor o igual a 1.');return;}
  const other=rutina.findIndex((d,i)=>i!==di&&Number(d.numero)===number);
  if(other!==-1){const current=Number(rutina[di].numero);rutina[other].numero=current;}
  rutina[di].numero=number;
  rutina[di].titulo=name;
  rutina.sort((a,b)=>Number(a.numero)-Number(b.numero));
  selectedEditorDay=rutina.findIndex(d=>Number(d.numero)===number);
  save();render();renderEditor();
}

function openEditor(){editor.classList.add("open");renderEditor();}
function editExercise(di,ei){
  const ex=ei<0?{name:"",series:"3",reps:"10",url:""}:rutina[di].ejercicios[ei];
  formTitleEl.textContent=ei<0?"Agregar ejercicio":"Editar ejercicio";
  exerciseNameEl.value=ex.name||"";exerciseSeriesEl.value=ex.series||"";exerciseRepsEl.value=ex.reps||"";exerciseUrlEl.value=ex.url||"";
  exerciseFormEl.classList.add("open");
  exerciseFormEl.dataset.di=di;exerciseFormEl.dataset.ei=ei;
}
exerciseFormEl.onsubmit=e=>{
  e.preventDefault();
  const di=Number(exerciseFormEl.dataset.di),ei=Number(exerciseFormEl.dataset.ei);
  const ex={name:exerciseNameEl.value.trim(),series:exerciseSeriesEl.value.trim(),reps:exerciseRepsEl.value.trim(),url:exerciseUrlEl.value.trim()};
  ex.embed=yt(ex.url);
  if(!ex.name){alert("Escribe el nombre del ejercicio.");return;}
  if(ei<0)rutina[di].ejercicios.push(ex);else rutina[di].ejercicios[ei]=ex;
  save();exerciseFormEl.classList.remove("open");render();renderEditor();
};
function deleteExercise(di,ei){if(confirm("¿Eliminar este ejercicio?")){rutina[di].ejercicios.splice(ei,1);save();render();renderEditor();}}
function deleteDay(di){
  if(rutina.length===1){alert("Debe existir al menos un día.");return;}
  if(confirm("¿Eliminar este día?")){
    rutina.splice(di,1);
    if(selectedEditorDay>=rutina.length) selectedEditorDay=Math.max(0,rutina.length-1);
    save();render();renderEditor();
  }
}
addDayBtn.onclick=()=>{
  const nums=rutina.map(d=>Number(d.numero)).filter(n=>Number.isFinite(n)&&n>0);
  const n=nums.length?Math.max(...nums)+1:1;
  const t=prompt("Nombre del nuevo día:",`Día ${n}`);
  if(!t||!t.trim()) return;
  rutina.push({numero:n,titulo:t.trim(),ejercicios:[]});
  rutina.sort((a,b)=>Number(a.numero)-Number(b.numero));
  selectedEditorDay=rutina.findIndex(d=>Number(d.numero)===n);
  save();render();renderEditor();
};
exportDataBtn.onclick=()=>{
  const b=new Blob([JSON.stringify(rutina,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="mi-rutina-backup.json";a.click();URL.revokeObjectURL(a.href);
};
resetDataBtn.onclick=()=>{if(confirm("¿Restaurar la rutina original?")){localStorage.removeItem(KEY);location.reload();}};
editorBtn.onclick=openEditor;
closeEditorBtn.onclick=()=>editor.classList.remove("open");
cancelExerciseBtn.onclick=()=>exerciseFormEl.classList.remove("open");

render();
